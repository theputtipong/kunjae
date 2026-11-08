/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import { buildItemAad, ItemChangeSchema, SYNC_LIMITS, SyncPullResponseSchema, SyncPushRequestSchema } from "./sync.ts";

const ITEM_ID = "01J00000000000000000000001";
const VAULT_ID = "01J00000000000000000000000";

const tombstone = (baseVersion: number, version: number) => ({
  itemId: ITEM_ID,
  vaultId: VAULT_ID,
  baseVersion,
  version,
  deleted: true,
});

void test("ItemChange requires version to be baseVersion + 1", () => {
  assert.ok(ItemChangeSchema.safeParse(tombstone(0, 1)).success);
  assert.ok(ItemChangeSchema.safeParse(tombstone(4, 5)).success);
  assert.ok(!ItemChangeSchema.safeParse(tombstone(1, 1)).success);
  assert.ok(!ItemChangeSchema.safeParse(tombstone(1, 3)).success);
  assert.ok(!ItemChangeSchema.safeParse(tombstone(-1, 0)).success);
});

void test("ItemChange rejects an upsert without an envelope and unknown keys", () => {
  assert.ok(!ItemChangeSchema.safeParse({ ...tombstone(0, 1), deleted: false }).success);
  assert.ok(!ItemChangeSchema.safeParse({ ...tombstone(0, 1), extra: true }).success);
});

void test("push batches are bounded", () => {
  assert.ok(!SyncPushRequestSchema.safeParse({ changes: [] }).success);
  const full = Array.from({ length: SYNC_LIMITS.pushBatchSize + 1 }, () => tombstone(0, 1));
  assert.ok(!SyncPushRequestSchema.safeParse({ changes: full }).success);
});

void test("pull responses are strict", () => {
  const empty = { vaults: [], items: [], revision: 0, hasMore: false };
  assert.ok(SyncPullResponseSchema.safeParse(empty).success);
  assert.ok(!SyncPullResponseSchema.safeParse({ ...empty, extra: 1 }).success);
  assert.ok(!SyncPullResponseSchema.safeParse({ ...empty, revision: -1 }).success);
});

void test("item AAD binds id and version", () => {
  assert.equal(buildItemAad(ITEM_ID, 3), `kunjae.v1.item|${ITEM_ID}|3`);
});
