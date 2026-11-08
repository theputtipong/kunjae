/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";

import { ACCOUNT_A, VAULT_A, createTestDatabase, scalar, seedAccount } from "../testing/sqlite-d1.ts";
import { insertVault } from "./vaults.ts";

const VAULT_A2 = "01ARZ3NDEKTSV4RRFFQ69G5VA2";

void test("insertVault assigns the vault the same revision the account was bumped to", async () => {
  const { sqlite, db } = createTestDatabase();
  seedAccount(sqlite, { accountId: ACCOUNT_A, email: "a@example.com", vaultId: VAULT_A, revision: 5 });

  const inserted = await insertVault(db, {
    accountId: ACCOUNT_A,
    vaultId: VAULT_A2,
    wrappedVaultKey: "{}",
    metadata: "{}",
    now: "2026-01-01T00:00:00.000Z",
  });

  assert.ok(inserted.ok);
  assert.equal(scalar(sqlite, "SELECT revision FROM accounts WHERE account_id = ?", ACCOUNT_A), 6);
  assert.equal(scalar(sqlite, "SELECT revision FROM vaults WHERE vault_id = ?", VAULT_A2), 6);
});
