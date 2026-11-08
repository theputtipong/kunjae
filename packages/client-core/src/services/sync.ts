import { SYNC_LIMITS, type ItemChange, type SyncedItem, type VaultRecord } from "@kunjae/contracts";
import { err, ok } from "@kunjae/core-crypto";
import {
  createItem,
  deleteItem,
  openItem,
  normalizeItemContent,
  openVault,
  updateItem,
  type DomainError,
  type ItemContent,
} from "@kunjae/domain";

import { apiSyncPull, apiSyncPush } from "../api/client.ts";
import {
  addUnlockedVault,
  hasUnlockedVault,
  isLocalSession,
  withVaultKey,
  withWrappingKey,
} from "../session/vault-session.ts";
import { applyLocalChange, reloadLocalVault } from "../local/local-store.ts";
import {
  getItemContent,
  getItemRef,
  getRevision,
  getVaultVersion,
  markBroken,
  removeItem,
  setRevision,
  setSyncing,
  upsertItem,
  upsertVault,
} from "../store/vault-store.ts";
import { ensureToken } from "./auth.ts";
import {
  conflict,
  fromApiError,
  invalidInput,
  lockIfSessionExpired,
  sessionExpired,
  unexpected,
  untrustedServer,
  type AppError,
  type AppResult,
} from "./errors.ts";

const MAX_PULL_ROUNDS = 100;

const fromSealError = (error: DomainError): AppError =>
  error.kind === "ItemContentInvalid" ? invalidInput(error.fields[0] ?? "item") : unexpected();

const absorbVault = async (record: VaultRecord): Promise<AppResult<void>> => {
  const known = getVaultVersion(record.vaultId);
  if (known !== null && record.version < known) return ok(undefined);

  const opened = await withWrappingKey(async (wrappingKey) => openVault(wrappingKey, record));
  if (opened === null) return err(sessionExpired());

  if (!opened.ok) return err(untrustedServer());

  addUnlockedVault({ vaultId: opened.value.vaultId, key: opened.value.key });

  upsertVault({
    vaultId: opened.value.vaultId,
    version: opened.value.version,
    metadata: opened.value.metadata,
    wrapped: { vaultId: record.vaultId, wrappedVaultKey: record.wrappedVaultKey },
  });

  return ok(undefined);
};

const absorbItem = async (record: SyncedItem): Promise<void> => {
  const known = getItemRef(record.itemId);
  if (known !== null && record.version < known.version) return;

  if (record.deleted) {
    removeItem(record.itemId);
    return;
  }

  const opened = await withVaultKey(record.vaultId, async (key) => openItem(key, record));

  if (opened?.ok !== true) {
    markBroken(record.itemId);
    return;
  }

  upsertItem(opened.value);
};

export const pull = async (nowMs: number): Promise<AppResult<void>> => {
  setSyncing(true);

  try {
    if (isLocalSession()) return await reloadLocalVault();

    for (let round = 0; round < MAX_PULL_ROUNDS; round += 1) {
      const token = await ensureToken(nowMs);
      if (!token.ok) return token;

      const page = await apiSyncPull({ since: getRevision() }, token.value);
      if (!page.ok) return err(lockIfSessionExpired(fromApiError(page.error)));

      for (const record of page.value.vaults) {
        const absorbed = await absorbVault(record);
        if (!absorbed.ok) return absorbed;
      }

      for (const record of page.value.items) {
        await absorbItem(record);
      }

      setRevision(page.value.revision);

      if (!page.value.hasMore) return ok(undefined);
    }

    return err(unexpected());
  } finally {
    setSyncing(false);
  }
};

const pushChange = async (change: ItemChange, nowMs: number): Promise<AppResult<void>> => {
  if (isLocalSession()) return applyLocalChange(change);

  const token = await ensureToken(nowMs);
  if (!token.ok) return token;

  const result = await apiSyncPush({ changes: [change] }, token.value);
  if (!result.ok) return err(lockIfSessionExpired(fromApiError(result.error)));

  if (result.value.conflicts.length > 0) {
    await pull(nowMs);
    return err(conflict());
  }

  return ok(undefined);
};

export type SaveItemParams = {
  readonly itemId: string;
  readonly vaultId: string;
  readonly content: ItemContent;
  readonly baseVersion: number;
  readonly nowMs: number;
};

export const saveItem = async (params: SaveItemParams): Promise<AppResult<void>> => {
  const now = new Date(params.nowMs).toISOString();

  const normalized = normalizeItemContent(params.content);
  if (!normalized.ok) return err(fromSealError(normalized.error));
  const content = normalized.value;

  const change = await withVaultKey(params.vaultId, async (key) =>
    params.baseVersion === 0
      ? createItem(key, {
          itemId: params.itemId,
          vaultId: params.vaultId,
          content,
          now,
        })
      : updateItem(
          key,
          { itemId: params.itemId, vaultId: params.vaultId, version: params.baseVersion },
          content,
          now,
        ),
  );

  if (change === null) return err(sessionExpired());
  if (!change.ok) return err(fromSealError(change.error));

  const pushed = await pushChange(change.value, params.nowMs);
  if (!pushed.ok) return pushed;

  if (!hasUnlockedVault(params.vaultId)) return err(sessionExpired());

  upsertItem({
    itemId: params.itemId,
    vaultId: params.vaultId,
    version: change.value.version,
    content: { ...content, updatedAt: now },
  });

  return ok(undefined);
};

export type NewItem = {
  readonly itemId: string;
  readonly content: ItemContent;
};

export type NewItemsOutcome = {
  readonly savedIds: readonly string[];
  readonly conflictedIds: readonly string[];
  readonly failedIds: readonly string[];
  readonly error: AppError | null;
};

type PreparedItem = {
  readonly item: NewItem;
  readonly content: ItemContent;
  readonly change: ItemChange;
};

const prepareNewItem = async (
  vaultId: string,
  item: NewItem,
  now: string,
): Promise<AppResult<PreparedItem>> => {
  const normalized = normalizeItemContent(item.content);
  if (!normalized.ok) return err(fromSealError(normalized.error));

  const change = await withVaultKey(vaultId, async (key) =>
    createItem(key, { itemId: item.itemId, vaultId, content: normalized.value, now }),
  );
  if (change === null) return err(sessionExpired());
  if (!change.ok) return err(fromSealError(change.error));

  return ok({ item, content: { ...normalized.value, updatedAt: now }, change: change.value });
};

const sendNewChanges = async (
  changes: readonly ItemChange[],
  nowMs: number,
): Promise<AppResult<{ readonly applied: ReadonlySet<string>; readonly conflicted: ReadonlySet<string> }>> => {
  if (isLocalSession()) {
    const applied = new Set<string>();
    const conflicted = new Set<string>();
    for (const change of changes) {
      const result = await applyLocalChange(change);
      if (result.ok) applied.add(change.itemId);
      else if (result.error.kind === "Conflict") conflicted.add(change.itemId);
      else return applied.size > 0 ? ok({ applied, conflicted }) : result;
    }
    return ok({ applied, conflicted });
  }

  const token = await ensureToken(nowMs);
  if (!token.ok) return token;

  const result = await apiSyncPush({ changes: [...changes] }, token.value);
  if (!result.ok) return err(lockIfSessionExpired(fromApiError(result.error)));

  return ok({
    applied: new Set(result.value.applied.map((applied) => applied.itemId)),
    conflicted: new Set(result.value.conflicts.map((conflicted) => conflicted.itemId)),
  });
};

export const pushNewItems = async (
  vaultId: string,
  items: readonly NewItem[],
  nowMs: number,
): Promise<NewItemsOutcome> => {
  const now = new Date(nowMs).toISOString();
  const savedIds: string[] = [];
  const conflictedIds: string[] = [];
  const failedIds: string[] = [];
  let error: AppError | null = null;

  for (let start = 0; start < items.length; start += SYNC_LIMITS.pushBatchSize) {
    const batch = items.slice(start, start + SYNC_LIMITS.pushBatchSize);

    if (error !== null) {
      failedIds.push(...batch.map((item) => item.itemId));
      continue;
    }

    const prepared: PreparedItem[] = [];
    for (const item of batch) {
      const ready = await prepareNewItem(vaultId, item, now);
      if (ready.ok) prepared.push(ready.value);
      else failedIds.push(item.itemId);
    }
    if (prepared.length === 0) continue;

    const sent = await sendNewChanges(
      prepared.map((entry) => entry.change),
      nowMs,
    );
    if (!sent.ok) {
      error = sent.error;
      failedIds.push(...prepared.map((entry) => entry.item.itemId));
      continue;
    }

    const unlocked = hasUnlockedVault(vaultId);
    for (const entry of prepared) {
      const id = entry.item.itemId;
      if (sent.value.applied.has(id)) {
        savedIds.push(id);
        if (unlocked) upsertItem({ itemId: id, vaultId, version: entry.change.version, content: entry.content });
      } else if (sent.value.conflicted.has(id)) {
        conflictedIds.push(id);
      } else {
        failedIds.push(id);
      }
    }
  }

  return { savedIds, conflictedIds, failedIds, error };
};

export const saveNewItems = async (
  vaultId: string,
  items: readonly NewItem[],
  nowMs: number,
): Promise<AppResult<number>> => {
  const outcome = await pushNewItems(vaultId, items, nowMs);
  if (outcome.error !== null && outcome.savedIds.length === 0) return err(outcome.error);
  return ok(outcome.savedIds.length);
};

export const deleteItemById = async (
  ref: { readonly itemId: string; readonly vaultId: string; readonly version: number },
  nowMs: number,
): Promise<AppResult<void>> => {
  const pushed = await pushChange(deleteItem(ref), nowMs);
  if (!pushed.ok) return pushed;

  removeItem(ref.itemId);
  return ok(undefined);
};

export const moveItemToVault = async (params: {
  readonly itemId: string;
  readonly targetVaultId: string;
  readonly nowMs: number;
}): Promise<AppResult<void>> => {
  const ref = getItemRef(params.itemId);
  if (ref === null) return err(unexpected());

  if (ref.vaultId === params.targetVaultId) return ok(undefined);

  const content = getItemContent(params.itemId);
  if (content === null) return err(unexpected());

  return saveItem({
    itemId: params.itemId,
    vaultId: params.targetVaultId,
    content,
    baseVersion: ref.version,
    nowMs: params.nowMs,
  });
};
