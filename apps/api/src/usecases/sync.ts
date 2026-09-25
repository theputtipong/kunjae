import {
  SYNC_LIMITS,
  type SyncPullRequest,
  type SyncPullResponse,
  type SyncPushRequest,
  type SyncPushResponse,
  type SyncedItem,
  type VaultRecord,
  type ItemChange,
} from "@kunjae/contracts";
import { err, ok } from "@kunjae/core-crypto";

import { currentRevision, findItemStates, listItemsSince, applyItemWrites, type ItemState, type ItemWrite } from "../db/items.ts";
import { filterOwnedVaultIds, listVaultsSince } from "../db/vaults.ts";
import { isoNow, type Deps } from "./deps.ts";
import { internal, invalidRequest, type UseCaseResult } from "./errors.ts";
import { parseStoredEnvelope } from "./stored-envelope.ts";

export const syncPull = async (
  deps: Deps,
  accountId: string,
  request: SyncPullRequest,
): Promise<UseCaseResult<SyncPullResponse>> => {
  const pageSize = SYNC_LIMITS.pullPageSize;

  const vaultRows = await listVaultsSince(deps.db, accountId, request.since);
  if (!vaultRows.ok) return err(internal());

  const itemRows = await listItemsSince(deps.db, accountId, request.since, pageSize + 1);
  if (!itemRows.ok) return err(internal());

  const hasMore = itemRows.value.length > pageSize;
  const page = hasMore ? itemRows.value.slice(0, pageSize) : itemRows.value;

  const vaults: VaultRecord[] = [];
  for (const row of vaultRows.value) {
    const wrappedVaultKey = parseStoredEnvelope(row.wrappedVaultKey);
    if (!wrappedVaultKey.ok) return wrappedVaultKey;

    const metadata = parseStoredEnvelope(row.metadata);
    if (!metadata.ok) return metadata;

    vaults.push({
      vaultId: row.vaultId,
      version: row.version,
      updatedAt: row.updatedAt,
      wrappedVaultKey: wrappedVaultKey.value,
      metadata: metadata.value,
    });
  }

  const items: SyncedItem[] = [];
  for (const row of page) {
    if (row.deleted) {
      items.push({
        itemId: row.itemId,
        vaultId: row.vaultId,
        version: row.version,
        updatedAt: row.updatedAt,
        deleted: true,
      });
      continue;
    }

    if (row.envelope === null) return err(internal());

    const envelope = parseStoredEnvelope(row.envelope);
    if (!envelope.ok) return envelope;

    items.push({
      itemId: row.itemId,
      vaultId: row.vaultId,
      version: row.version,
      updatedAt: row.updatedAt,
      deleted: false,
      envelope: envelope.value,
    });
  }

  if (hasMore) {
    const last = page[page.length - 1];
    if (last === undefined) return err(internal());

    return ok({ vaults, items, revision: last.revision, hasMore: true });
  }

  const revision = await currentRevision(deps.db, accountId);
  if (!revision.ok) return err(internal());

  return ok({ vaults, items, revision: revision.value, hasMore: false });
};

export type WritePlan = {
  readonly writes: readonly ItemWrite[];
  readonly conflicts: readonly { readonly itemId: string; readonly serverVersion: number }[];
};

export const planWrites = (
  changes: readonly ItemChange[],
  states: readonly ItemState[],
): WritePlan | null => {
  const byId = new Map(states.map((state) => [state.itemId, state]));

  const writes: ItemWrite[] = [];
  const conflicts: { itemId: string; serverVersion: number }[] = [];

  for (const change of changes) {
    const existing = byId.get(change.itemId);

    if (existing === undefined) {
      if (change.baseVersion !== 0) return null;

      writes.push({
        itemId: change.itemId,
        vaultId: change.vaultId,
        version: change.version,
        baseVersion: change.baseVersion,
        deleted: change.deleted,
        envelope: change.deleted ? null : JSON.stringify(change.envelope),
      });
      continue;
    }

    if (existing.version !== change.baseVersion) {
      conflicts.push({ itemId: change.itemId, serverVersion: existing.version });
      continue;
    }

    writes.push({
      itemId: change.itemId,
      vaultId: change.vaultId,
      version: change.version,
      baseVersion: change.baseVersion,
      deleted: change.deleted,
      envelope: change.deleted ? null : JSON.stringify(change.envelope),
    });
  }

  return { writes, conflicts };
};

export const syncPush = async (
  deps: Deps,
  accountId: string,
  request: SyncPushRequest,
): Promise<UseCaseResult<SyncPushResponse>> => {
  const requestedVaultIds = [...new Set(request.changes.map((change) => change.vaultId))];

  const owned = await filterOwnedVaultIds(deps.db, accountId, requestedVaultIds);
  if (!owned.ok) return err(internal());

  if (owned.value.length !== requestedVaultIds.length) return err(invalidRequest());

  const itemIds = request.changes.map((change) => change.itemId);

  const states = await findItemStates(deps.db, accountId, itemIds);
  if (!states.ok) return err(internal());

  const plan = planWrites(request.changes, states.value);
  if (plan === null) return err(invalidRequest());

  const applied = await applyItemWrites(deps.db, accountId, plan.writes, isoNow(deps.nowMs));
  if (!applied.ok) return err(internal());

  const appliedIds = new Set(applied.value.map((item) => item.itemId));
  const lost = plan.writes.filter((write) => !appliedIds.has(write.itemId));

  const conflicts = [...plan.conflicts];

  if (lost.length > 0) {
    const latest = await findItemStates(deps.db, accountId, lost.map((write) => write.itemId));
    if (!latest.ok) return err(internal());

    const latestById = new Map(latest.value.map((state) => [state.itemId, state]));

    for (const write of lost) {
      const state = latestById.get(write.itemId);
      if (state === undefined) return err(internal());

      conflicts.push({ itemId: write.itemId, serverVersion: state.version });
    }
  }

  const revision = await currentRevision(deps.db, accountId);
  if (!revision.ok) return err(internal());

  return ok({
    applied: applied.value.map((item) => ({
      itemId: item.itemId,
      version: item.version,
      updatedAt: item.updatedAt,
    })),
    conflicts,
    revision: revision.value,
  });
};
