/// <reference types="node" />
import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import type { ApiErrorCode } from "@kunjae/contracts";

import { NOW_MS, openAccountSession } from "../testing/fake-api.ts";
import { getSessionView, getUsableToken, lockSession } from "../session/vault-session.ts";
import { clearStore } from "../store/vault-store.ts";
import { pull } from "./sync.ts";

afterEach(() => {
  mock.restoreAll();
  lockSession();
  clearStore();
});

const transient: readonly (readonly [number, ApiErrorCode, string])[] = [
  [503, "UNAVAILABLE", "ServiceUnavailable"],
  [500, "RATE_LIMITED", "RateLimited"],
  [500, "INTERNAL", "Unexpected"],
];

for (const [status, code, kind] of transient) {
  void test(`token refresh keeps the session unlocked on ${code}`, async () => {
    const { server } = await openAccountSession({ tokenExpiresAtMs: NOW_MS });
    server.loginFailures.push({ status, code });

    const pulled = await pull(NOW_MS);

    assert.deepEqual(pulled, { ok: false, error: { kind } });
    assert.equal(getSessionView().status, "unlocked");

    assert.ok((await pull(NOW_MS)).ok);
    assert.equal(getUsableToken(NOW_MS), "renewed");
  });
}

void test("token refresh keeps the session unlocked when offline", async () => {
  await openAccountSession({ tokenExpiresAtMs: NOW_MS });
  mock.method(globalThis, "fetch", () => Promise.reject(new TypeError("network down")));

  const pulled = await pull(NOW_MS);

  assert.deepEqual(pulled, { ok: false, error: { kind: "Offline" } });
  assert.equal(getSessionView().status, "unlocked");
});

const fatal: readonly (readonly [ApiErrorCode, string])[] = [
  ["UNAUTHORIZED", "SessionExpired"],
  ["INVALID_CREDENTIALS", "WrongCredentials"],
];

for (const [code, kind] of fatal) {
  void test(`token refresh locks the session on ${code}`, async () => {
    const { server } = await openAccountSession({ tokenExpiresAtMs: NOW_MS });
    server.loginFailures.push({ status: 401, code });

    const pulled = await pull(NOW_MS);

    assert.deepEqual(pulled, { ok: false, error: { kind } });
    assert.equal(getSessionView().status, "locked");
  });
}
