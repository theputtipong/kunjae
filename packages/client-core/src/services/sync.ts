import { SYNC_LIMITS, type ItemChange, type SyncedItem, type VaultRecord } from "@kunjae/contracts";
import { err, ok } from "@kunjae/core-crypto";
import {
  createItem,
  deleteItem,
  openItem,
  openVault,
  updateItem,
  type ItemContent,
} from "@kunjae/domain";

import { apiSyncPull, apiSyncPush } from "../api/client.ts";
import {
  addUnlockedVault,
  isLocalSession,
  withVaultKey,
  withWrappingKey,
} from "../session/vault-session.ts";
import { applyLocalChange, reloadLocalVault } from "../local/local-store.ts";
import {
  getItemContent,
  getItemRef,
  getRevision,
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
  lockIfSessionExpired,
  sessionExpired,
  unexpected,
  untrustedServer,
  type AppResult,
} from "./errors.ts";

const MAX_PULL_ROUNDS = 100;

const absorbVault = async (record: VaultRecord): Promise<AppResult<void>> => {
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

  setRevision(result.value.revision);
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

  const change = await withVaultKey(params.vaultId, async (key) =>
    params.baseVersion === 0
      ? createItem(key, {
          itemId: params.itemId,
          vaultId: params.vaultId,
          content: params.content,
          now,
        })
      : updateItem(
          key,
          { itemId: params.itemId, vaultId: params.vaultId, version: params.baseVersion },
          params.content,
          now,
        ),
  );

  if (change === null) return err(sessionExpired());
  if (!change.ok) return err(unexpected());

  const pushed = await pushChange(change.value, params.nowMs);
  if (!pushed.ok) return pushed;

  upsertItem({
    itemId: params.itemId,
    vaultId: params.vaultId,
    version: change.value.version,
    content: params.content,
  });

  return ok(undefined);
};

export type NewItem = {
  readonly itemId: string;
  readonly content: ItemContent;
};

export const saveNewItems = async (
  vaultId: string,
  items: readonly NewItem[],
  nowMs: number,
): Promise<AppResult<number>> => {
  const now = new Date(nowMs).toISOString();
  let saved = 0;

  for (let start = 0; start < items.length; start += SYNC_LIMITS.pushBatchSize) {
    const batch = items.slice(start, start + SYNC_LIMITS.pushBatchSize);
    const changes: ItemChange[] = [];

    for (const item of batch) {
      const change = await withVaultKey(vaultId, async (key) =>
        createItem(key, { itemId: item.itemId, vaultId, content: item.content, now }),
      );
      if (change === null) return err(sessionExpired());
      if (!change.ok) return err(unexpected());
      changes.push(change.value);
    }

    let appliedIds: ReadonlySet<string>;

    if (isLocalSession()) {
      appliedIds = new Set(changes.map((change) => change.itemId));
      for (const change of changes) {
        const applied = await applyLocalChange(change);
        if (!applied.ok) return saved > 0 ? ok(saved) : applied;
      }
    } else {
      const token = await ensureToken(nowMs);
      if (!token.ok) return saved > 0 ? ok(saved) : token;

      const result = await apiSyncPush({ changes }, token.value);
      if (!result.ok) {
        const failure = err(lockIfSessionExpired(fromApiError(result.error)));
        return saved > 0 ? ok(saved) : failure;
      }
      setRevision(result.value.revision);
      appliedIds = new Set(result.value.applied.map((applied) => applied.itemId));
    }

    for (const [index, item] of batch.entries()) {
      const change = changes[index];
      if (change === undefined || !appliedIds.has(item.itemId)) continue;
      upsertItem({ itemId: item.itemId, vaultId, version: change.version, content: item.content });
      saved += 1;
    }
  }

  return ok(saved);
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
