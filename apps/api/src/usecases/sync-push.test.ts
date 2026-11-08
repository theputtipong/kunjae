/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";

import type { ItemChange } from "@kunjae/contracts";

import {
  ACCOUNT_A,
  ACCOUNT_B,
  ENVELOPE,
  VAULT_A,
  VAULT_B,
  createTestDatabase,
  scalar,
  seedAccount,
  testSecrets,
} from "../testing/sqlite-d1.ts";
import type { Deps } from "./deps.ts";
import { planWrites, syncPush } from "./sync.ts";

const ITEM_1 = "01ARZ3NDEKTSV4RRFFQ69G5T01";

const upsert = (vaultId: string, itemId: string, baseVersion: number): Extract<ItemChange, { deleted: false }> => ({
  itemId,
  vaultId,
  version: baseVersion + 1,
  baseVersion,
  deleted: false,
  envelope: ENVELOPE,
});

const setup = () => {
  const test = createTestDatabase();
  seedAccount(test.sqlite, { accountId: ACCOUNT_A, email: "a@example.com", vaultId: VAULT_A });
  seedAccount(test.sqlite, { accountId: ACCOUNT_B, email: "b@example.com", vaultId: VAULT_B });
  const deps: Deps = { db: test.db, secrets: testSecrets(), nowMs: Date.UTC(2026, 0, 1) };
  return { ...test, deps };
};

void test("syncPush rejects a change targeting a vault owned by another account", async () => {
  const { sqlite, deps } = setup();

  const result = await syncPush(deps, ACCOUNT_A, { changes: [upsert(VAULT_B, ITEM_1, 0)] });

  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.equal(result.error.kind, "InvalidRequest");
  assert.equal(scalar(sqlite, "SELECT COUNT(*) FROM items"), 0);
});

void test("syncPush rejects a batch mixing owned and foreign vaults", async () => {
  const { sqlite, deps } = setup();

  const result = await syncPush(deps, ACCOUNT_A, {
    changes: [upsert(VAULT_A, ITEM_1, 0), upsert(VAULT_B, "01ARZ3NDEKTSV4RRFFQ69G5T02", 0)],
  });

  assert.ok(!result.ok);
  assert.equal(result.error.kind, "InvalidRequest");
  assert.equal(scalar(sqlite, "SELECT COUNT(*) FROM items"), 0);
});

void test("syncPush never overwrites an itemId owned by another account", async () => {
  const { sqlite, deps } = setup();

  const seeded = await syncPush(deps, ACCOUNT_B, { changes: [upsert(VAULT_B, ITEM_1, 0)] });
  assert.ok(seeded.ok);
  assert.equal(seeded.value.applied.length, 1);

  const before = sqlite.prepare("SELECT account_id, vault_id, version, envelope FROM items WHERE item_id = ?").get(ITEM_1);

  const attack = await syncPush(deps, ACCOUNT_A, {
    changes: [{ ...upsert(VAULT_A, ITEM_1, 0), envelope: { ...ENVELOPE, ct: "ZXZpbA" } }],
  });

  if (attack.ok) assert.equal(attack.value.applied.length, 0);

  const after = sqlite.prepare("SELECT account_id, vault_id, version, envelope FROM items WHERE item_id = ?").get(ITEM_1);
  assert.deepEqual(after, before);
  assert.equal(scalar(sqlite, "SELECT account_id FROM items WHERE item_id = ?", ITEM_1), ACCOUNT_B);
});

void test("syncPush reports a conflict when baseVersion does not match the stored version", async () => {
  const { sqlite, deps } = setup();

  const first = await syncPush(deps, ACCOUNT_A, { changes: [upsert(VAULT_A, ITEM_1, 0)] });
  assert.ok(first.ok);

  const second = await syncPush(deps, ACCOUNT_A, { changes: [upsert(VAULT_A, ITEM_1, 0)] });
  assert.ok(second.ok);
  assert.deepEqual(second.value.applied, []);
  assert.deepEqual(second.value.conflicts, [{ itemId: ITEM_1, serverVersion: 1 }]);
  assert.equal(scalar(sqlite, "SELECT version FROM items WHERE item_id = ?", ITEM_1), 1);
});

void test("planWrites flags baseVersion mismatch as conflict and rejects unknown items with non-zero base", () => {
  const state = { itemId: ITEM_1, vaultId: VAULT_A, version: 3 };

  const mismatch = planWrites([upsert(VAULT_A, ITEM_1, 2)], [state]);
  assert.deepEqual(mismatch, { writes: [], conflicts: [{ itemId: ITEM_1, serverVersion: 3 }] });

  const matched = planWrites([upsert(VAULT_A, ITEM_1, 3)], [state]);
  assert.equal(matched?.writes.length, 1);
  assert.deepEqual(matched.conflicts, []);

  assert.equal(planWrites([upsert(VAULT_A, ITEM_1, 1)], []), null);
});
