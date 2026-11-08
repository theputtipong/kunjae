/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";

import type { ChangeMasterPasswordRequest } from "@kunjae/contracts";

import { hashAuthKey } from "../crypto/auth-key.ts";
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
  type SqliteD1Options,
} from "../testing/sqlite-d1.ts";
import { changeMasterPassword } from "./change-password.ts";
import type { Deps } from "./deps.ts";

const CURRENT_AUTH_KEY = "Y3VycmVudC1hdXRoLWtleS0zMi1ieXRlcy1sb25nISE";
const NEW_AUTH_KEY = "bmV3LWF1dGgta2V5LTMyLWJ5dGVzLWxvbmctLS0tLS0";
const VAULT_A2 = "01ARZ3NDEKTSV4RRFFQ69G5VA2";
const NEW_WRAP = { ...ENVELOPE, ct: "bmV3LXdyYXA" };

const setup = async (options: SqliteD1Options = {}) => {
  const test = createTestDatabase(options);
  const secrets = testSecrets();
  const hashed = await hashAuthKey(secrets.authPepper, CURRENT_AUTH_KEY);
  assert.ok(hashed.ok);
  seedAccount(test.sqlite, { accountId: ACCOUNT_A, email: "a@example.com", vaultId: VAULT_A, authKeyHash: hashed.value });
  seedAccount(test.sqlite, { accountId: ACCOUNT_B, email: "b@example.com", vaultId: VAULT_B });
  const deps: Deps = { db: test.db, secrets, nowMs: Date.UTC(2026, 0, 1) };
  return { ...test, deps };
};

const requestFor = (vaultIds: readonly string[]): ChangeMasterPasswordRequest => ({
  currentAuthKey: CURRENT_AUTH_KEY,
  newAccountSalt: "bmV3c2FsdG5ld3NhbHRuZXc",
  newArgon2: { memoryKiB: 65536, iterations: 3, parallelism: 1, hashLength: 32 },
  newAuthKey: NEW_AUTH_KEY,
  rewrappedVaults: vaultIds.map((vaultId) => ({ vaultId, wrappedVaultKey: NEW_WRAP })),
});

const wrappedKeyOf = (sqlite: Awaited<ReturnType<typeof setup>>["sqlite"], vaultId: string): unknown =>
  scalar(sqlite, "SELECT wrapped_vault_key FROM vaults WHERE vault_id = ?", vaultId);

void test("changeMasterPassword rotates when every owned vault is rewrapped", async () => {
  const { sqlite, deps } = await setup();

  const result = await changeMasterPassword(deps, ACCOUNT_A, requestFor([VAULT_A]));

  assert.ok(result.ok);
  assert.equal(wrappedKeyOf(sqlite, VAULT_A), JSON.stringify(NEW_WRAP));
  assert.equal(scalar(sqlite, "SELECT token_epoch FROM accounts WHERE account_id = ?", ACCOUNT_A), 1);
});

void test("changeMasterPassword rejects a request missing an owned vault", async () => {
  const { sqlite, deps } = await setup();
  sqlite
    .prepare(
      "INSERT INTO vaults (vault_id, account_id, version, wrapped_vault_key, metadata, revision, updated_at) VALUES (?, ?, 1, 'x', 'x', 1, 'now')",
    )
    .run(VAULT_A2, ACCOUNT_A);

  const result = await changeMasterPassword(deps, ACCOUNT_A, requestFor([VAULT_A]));

  assert.ok(!result.ok);
  assert.equal(result.error.kind, "InvalidRequest");
  assert.equal(scalar(sqlite, "SELECT token_epoch FROM accounts WHERE account_id = ?", ACCOUNT_A), 0);
});

void test("changeMasterPassword rejects a request with an extra or foreign vault", async () => {
  const { sqlite, deps } = await setup();

  const extra = await changeMasterPassword(deps, ACCOUNT_A, requestFor([VAULT_A, VAULT_B]));
  assert.ok(!extra.ok);
  assert.equal(extra.error.kind, "InvalidRequest");

  const duplicate = await changeMasterPassword(deps, ACCOUNT_A, requestFor([VAULT_A, VAULT_A]));
  assert.ok(!duplicate.ok);
  assert.equal(duplicate.error.kind, "InvalidRequest");

  const swapped = await changeMasterPassword(deps, ACCOUNT_A, requestFor([VAULT_B]));
  assert.ok(!swapped.ok);
  assert.equal(swapped.error.kind, "InvalidRequest");

  assert.notEqual(wrappedKeyOf(sqlite, VAULT_B), JSON.stringify(NEW_WRAP));
  assert.equal(scalar(sqlite, "SELECT token_epoch FROM accounts WHERE account_id = ?", ACCOUNT_A), 0);
});

void test("changeMasterPassword rejects a wrong current auth key", async () => {
  const { deps } = await setup();

  const result = await changeMasterPassword(deps, ACCOUNT_A, { ...requestFor([VAULT_A]), currentAuthKey: NEW_AUTH_KEY });

  assert.ok(!result.ok);
  assert.equal(result.error.kind, "InvalidCredentials");
});

void test("changeMasterPassword does not rotate when a vault is created after the vault set was checked", async () => {
  let injected = false;
  const ref: { sqlite?: Awaited<ReturnType<typeof setup>>["sqlite"] } = {};
  const { sqlite, deps } = await setup({
    afterQuery: (query) => {
      if (injected || ref.sqlite === undefined) return;
      if (!query.includes(`from "vaults"`) || !query.startsWith("select")) return;
      injected = true;
      ref.sqlite
        .prepare(
          "INSERT INTO vaults (vault_id, account_id, version, wrapped_vault_key, metadata, revision, updated_at) VALUES (?, ?, 1, 'old', 'x', 1, 'now')",
        )
        .run(VAULT_A2, ACCOUNT_A);
    },
  });
  ref.sqlite = sqlite;

  const result = await changeMasterPassword(deps, ACCOUNT_A, requestFor([VAULT_A]));

  assert.ok(injected);
  assert.ok(!result.ok);
  assert.equal(result.error.kind, "Conflict");
  assert.equal(scalar(sqlite, "SELECT token_epoch FROM accounts WHERE account_id = ?", ACCOUNT_A), 0);
  assert.notEqual(wrappedKeyOf(sqlite, VAULT_A), JSON.stringify(NEW_WRAP));
});

void test("changeMasterPassword keeps vault keys when the token epoch moves before the rotation batch", async () => {
  let injected = false;
  const ref: { sqlite?: Awaited<ReturnType<typeof setup>>["sqlite"] } = {};
  const { sqlite, deps } = await setup({
    afterQuery: (query) => {
      if (injected || ref.sqlite === undefined) return;
      if (!query.includes(`from "vaults"`) || !query.startsWith("select")) return;
      injected = true;
      ref.sqlite.prepare("UPDATE accounts SET token_epoch = token_epoch + 1 WHERE account_id = ?").run(ACCOUNT_A);
    },
  });
  ref.sqlite = sqlite;

  const result = await changeMasterPassword(deps, ACCOUNT_A, requestFor([VAULT_A]));

  assert.ok(injected);
  assert.ok(!result.ok);
  assert.equal(result.error.kind, "Conflict");
  assert.notEqual(wrappedKeyOf(sqlite, VAULT_A), JSON.stringify(NEW_WRAP));
});
