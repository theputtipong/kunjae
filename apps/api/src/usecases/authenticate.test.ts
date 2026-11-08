/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";

import { TOKEN_TTL_SECONDS, issueToken, verifyToken } from "../crypto/token.ts";
import { ACCOUNT_A, VAULT_A, createTestDatabase, seedAccount, testSecrets } from "../testing/sqlite-d1.ts";
import { authenticate } from "./authenticate.ts";
import type { Deps } from "./deps.ts";

const NOW_MS = Date.UTC(2026, 0, 1);

const setup = (tokenEpoch: number) => {
  const { sqlite, db } = createTestDatabase();
  seedAccount(sqlite, { accountId: ACCOUNT_A, email: "a@example.com", vaultId: VAULT_A, tokenEpoch });
  const deps: Deps = { db, secrets: testSecrets(), nowMs: NOW_MS };
  return { sqlite, deps };
};

const tokenFor = async (deps: Deps, tokenEpoch: number, nowMs = NOW_MS): Promise<string> => {
  const issued = await issueToken(deps.secrets.tokenSecret, { accountId: ACCOUNT_A, tokenEpoch, nowMs });
  assert.ok(issued.ok);
  return issued.value.token;
};

void test("authenticate accepts a fresh token with the current epoch", async () => {
  const { deps } = setup(2);
  const result = await authenticate(deps, await tokenFor(deps, 2));
  assert.ok(result.ok);
  assert.equal(result.value.accountId, ACCOUNT_A);
});

void test("authenticate rejects a token whose MAC or payload was tampered with", async () => {
  const { deps } = setup(0);
  const token = await tokenFor(deps, 0);

  const lastDot = token.lastIndexOf(".");
  const mac = token.slice(lastDot + 1);
  const flipped = `${token.slice(0, lastDot + 1)}${mac.startsWith("A") ? "B" : "A"}${mac.slice(1)}`;
  const flippedResult = await authenticate(deps, flipped);
  assert.ok(!flippedResult.ok);
  assert.equal(flippedResult.error.kind, "Unauthorized");

  const prefix = "kunjae.tok.1.";
  const forgedClaims = btoa(JSON.stringify({ sub: ACCOUNT_A, ep: 0, exp: 9_999_999_999 }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
  const forged = `${prefix}${forgedClaims}.${mac}`;
  const forgedResult = await authenticate(deps, forged);
  assert.ok(!forgedResult.ok);
  assert.equal(forgedResult.error.kind, "Unauthorized");

  const otherSecret = await issueToken(new Uint8Array(32).fill(9), { accountId: ACCOUNT_A, tokenEpoch: 0, nowMs: NOW_MS });
  assert.ok(otherSecret.ok);
  const otherResult = await authenticate(deps, otherSecret.value.token);
  assert.ok(!otherResult.ok);
  assert.equal(otherResult.error.kind, "Unauthorized");
});

void test("authenticate rejects an expired token", async () => {
  const { deps } = setup(0);
  const token = await tokenFor(deps, 0, NOW_MS - TOKEN_TTL_SECONDS * 1000);

  const result = await authenticate(deps, token);
  assert.ok(!result.ok);
  assert.equal(result.error.kind, "Unauthorized");

  const verified = await verifyToken(deps.secrets.tokenSecret, token, NOW_MS - 1000);
  assert.ok(verified.ok);
});

void test("authenticate rejects a token issued for an older epoch", async () => {
  const { sqlite, deps } = setup(0);
  const token = await tokenFor(deps, 0);

  sqlite.prepare("UPDATE accounts SET token_epoch = token_epoch + 1 WHERE account_id = ?").run(ACCOUNT_A);

  const result = await authenticate(deps, token);
  assert.ok(!result.ok);
  assert.equal(result.error.kind, "Unauthorized");
});

void test("authenticate rejects a valid token for a deleted account", async () => {
  const { sqlite, deps } = setup(0);
  const token = await tokenFor(deps, 0);

  sqlite.prepare("DELETE FROM accounts WHERE account_id = ?").run(ACCOUNT_A);

  const result = await authenticate(deps, token);
  assert.ok(!result.ok);
  assert.equal(result.error.kind, "Unauthorized");
});
