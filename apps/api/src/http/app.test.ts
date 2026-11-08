/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";

import { bytesToBase64Url } from "@kunjae/core-crypto";

import { hashAuthKey } from "../crypto/auth-key.ts";
import {
  ACCOUNT_A,
  VAULT_A,
  createTestDatabase,
  seedAccount,
  testSecrets,
  type SqliteD1Options,
} from "../testing/sqlite-d1.ts";
import { createApp } from "./app.ts";

const EMAIL = "a@example.com";
const GOOD_KEY = bytesToBase64Url(new Uint8Array(32).fill(7));
const BAD_KEY = bytesToBase64Url(new Uint8Array(32).fill(8));
const STRONG_ADMIN_TOKEN = "admin-token-that-is-long-enough-0123456789";

const setup = async (options: SqliteD1Options = {}, extraEnv: Record<string, unknown> = {}) => {
  const database = createTestDatabase(options);
  const secrets = testSecrets();
  const hashed = await hashAuthKey(secrets.authPepper, GOOD_KEY);
  assert.ok(hashed.ok);
  seedAccount(database.sqlite, { accountId: ACCOUNT_A, email: EMAIL, vaultId: VAULT_A, authKeyHash: hashed.value });

  const env = {
    DB: database.d1,
    AUTH_PEPPER: bytesToBase64Url(secrets.authPepper),
    TOKEN_SECRET: bytesToBase64Url(secrets.tokenSecret),
    CHALLENGE_KEY: bytesToBase64Url(secrets.challengeKey),
    ...extraEnv,
  } as unknown as Env;

  const app = createApp();
  const request = (path: string, init: RequestInit = {}): Promise<Response> =>
    Promise.resolve(app.request(path, init, env));
  return { ...database, request };
};

const loginFinish = (
  request: (path: string, init?: RequestInit) => Promise<Response>,
  authKey: string,
  ip: string,
): Promise<Response> =>
  request("/v1/auth/login/finish", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
    body: JSON.stringify({ email: EMAIL, authKey }),
  });

void test("login/finish blocks an account after repeated failures spread across many IPs", async () => {
  const { request } = await setup();

  for (let i = 0; i < 10; i += 1) {
    const response = await loginFinish(request, BAD_KEY, `198.51.100.${String(i)}`);
    assert.equal(response.status, 401);
  }

  const blocked = await loginFinish(request, BAD_KEY, "203.0.113.1");
  assert.equal(blocked.status, 429);

  const blockedEvenWithGoodKey = await loginFinish(request, GOOD_KEY, "203.0.113.2");
  assert.equal(blockedEvenWithGoodKey.status, 429);
});

void test("login/finish does not count successful logins toward the per-account limit", async () => {
  const { request } = await setup();

  for (let i = 0; i < 15; i += 1) {
    const response = await loginFinish(request, GOOD_KEY, `198.51.100.${String(i)}`);
    assert.equal(response.status, 200);
  }

  for (let i = 0; i < 9; i += 1) {
    const response = await loginFinish(request, BAD_KEY, `203.0.113.${String(i)}`);
    assert.equal(response.status, 401);
  }

  const stillAllowed = await loginFinish(request, GOOD_KEY, "192.0.2.1");
  assert.equal(stillAllowed.status, 200);
});

void test("login/finish fails closed when the rate-limit store errors", async () => {
  const { request } = await setup({ failWhen: (query) => query.includes("rate_limits") });

  const wrong = await loginFinish(request, BAD_KEY, "198.51.100.1");
  assert.equal(wrong.status, 500);

  const right = await loginFinish(request, GOOD_KEY, "198.51.100.2");
  assert.equal(right.status, 500);
});

void test("request bodies without Content-Length are cut off at the 1 MiB cap", async () => {
  const { request } = await setup();

  const CHUNK = 64 * 1024;
  const TOTAL = 4 * 1024 * 1024;
  let pulled = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulled >= TOTAL) {
        controller.close();
        return;
      }
      pulled += CHUNK;
      controller.enqueue(new Uint8Array(CHUNK).fill(0x20));
    },
  });

  const response = await request("/v1/auth/login/begin", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.1" },
    body,
    duplex: "half",
  } as RequestInit);

  assert.equal(response.status, 400);
  assert.ok(pulled <= 2 * 1024 * 1024, `read ${String(pulled)} bytes`);
});

const adminUsage = (
  request: (path: string, init?: RequestInit) => Promise<Response>,
  token: string,
  ip = "198.51.100.1",
): Promise<Response> =>
  request("/v1/admin/usage", { headers: { "x-admin-token": token, "CF-Connecting-IP": ip } });

void test("admin usage endpoint is disabled when ADMIN_TOKEN is shorter than 32 characters", async () => {
  const weak = "short-admin-token";
  const { request } = await setup({}, { ADMIN_TOKEN: weak });

  const response = await adminUsage(request, weak);
  assert.equal(response.status, 404);
});

void test("admin usage endpoint accepts only the configured strong token", async () => {
  const { request } = await setup({}, { ADMIN_TOKEN: STRONG_ADMIN_TOKEN });

  assert.equal((await adminUsage(request, STRONG_ADMIN_TOKEN, "198.51.100.1")).status, 200);
  assert.equal((await adminUsage(request, `${STRONG_ADMIN_TOKEN}x`, "198.51.100.2")).status, 404);
  assert.equal((await adminUsage(request, "", "198.51.100.3")).status, 404);
});

void test("admin usage endpoint is rate limited per IP", async () => {
  const { request } = await setup({}, { ADMIN_TOKEN: STRONG_ADMIN_TOKEN });

  const statuses: number[] = [];
  for (let i = 0; i < 6; i += 1) statuses.push((await adminUsage(request, "wrong")).status);

  assert.deepEqual(statuses, [404, 404, 404, 404, 404, 429]);
});
