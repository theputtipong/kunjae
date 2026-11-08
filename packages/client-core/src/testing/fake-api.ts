/// <reference types="node" />
import assert from "node:assert/strict";
import { mock } from "node:test";

import type { ApiErrorCode, ItemChange, NewVault, SyncedItem, VaultRecord } from "@kunjae/contracts";
import { generateVaultKey, importVaultKey, type AccountKeys } from "@kunjae/core-crypto";
import { createVault } from "@kunjae/domain";

import { configureApi } from "../config.ts";
import { openSession } from "../session/vault-session.ts";

export const VAULT_ID = "01J00000000000000000000000";
export const NOW_MS = Date.parse("2026-01-01T00:00:00.000Z");
export const NOW = new Date(NOW_MS).toISOString();
const REQUEST_ID = "01J0000000000000000000000R";

export type FakeFailure = { readonly status: number; readonly code: ApiErrorCode; readonly afterApply?: boolean };

export type FakeServer = {
  revision: number;
  readonly items: Map<string, { record: SyncedItem; revision: number }>;
  readonly vaults: Map<string, VaultRecord>;
  readonly pushFailures: (FakeFailure | null)[];
  readonly loginFailures: FakeFailure[];
  pushCount: number;
  loginCount: number;
};

export const toRecord = (change: ItemChange): SyncedItem =>
  change.deleted
    ? { itemId: change.itemId, vaultId: change.vaultId, version: change.version, updatedAt: NOW, deleted: true }
    : {
        itemId: change.itemId,
        vaultId: change.vaultId,
        version: change.version,
        updatedAt: NOW,
        deleted: false,
        envelope: change.envelope,
      };

export const applyOnServer = (server: FakeServer, change: ItemChange): void => {
  server.revision += 1;
  server.items.set(change.itemId, { record: toRecord(change), revision: server.revision });
};

export const putRecordOnServer = (server: FakeServer, record: SyncedItem): void => {
  server.revision += 1;
  server.items.set(record.itemId, { record, revision: server.revision });
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const failureResponse = (failure: FakeFailure): Response =>
  jsonResponse({ code: failure.code, requestId: REQUEST_ID }, failure.status);

const push = (server: FakeServer, changes: readonly ItemChange[]): Response => {
  server.pushCount += 1;
  const failure = server.pushFailures.shift() ?? undefined;
  if (failure !== undefined && failure.afterApply !== true) return failureResponse(failure);

  const applied: { itemId: string; version: number; updatedAt: string }[] = [];
  const conflicts: { itemId: string; serverVersion: number }[] = [];

  for (const change of changes) {
    const existing = server.items.get(change.itemId);
    if (existing === undefined && change.baseVersion !== 0) {
      return failureResponse({ status: 400, code: "INVALID_REQUEST" });
    }
    if (existing !== undefined && existing.record.version !== change.baseVersion) {
      conflicts.push({ itemId: change.itemId, serverVersion: existing.record.version });
      continue;
    }
    applyOnServer(server, change);
    applied.push({ itemId: change.itemId, version: change.version, updatedAt: NOW });
  }

  if (failure !== undefined) return failureResponse(failure);

  return jsonResponse({ applied, conflicts, revision: server.revision });
};

export const installFakeServer = (server: FakeServer): void => {
  mock.method(globalThis, "fetch", (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
      readonly since?: number;
      readonly changes?: readonly ItemChange[];
      readonly vault?: NewVault;
    };

    if (url.endsWith("/v1/sync/pull")) {
      const since = body.since ?? 0;
      const items = [...server.items.values()]
        .filter((entry) => entry.revision > since)
        .map((entry) => entry.record);
      return Promise.resolve(
        jsonResponse({ vaults: [...server.vaults.values()], items, revision: server.revision, hasMore: false }),
      );
    }

    if (url.endsWith("/v1/sync/push")) return Promise.resolve(push(server, body.changes ?? []));

    if (url.endsWith("/v1/vaults") && body.vault !== undefined) {
      server.vaults.set(body.vault.vaultId, {
        vaultId: body.vault.vaultId,
        version: 1,
        updatedAt: NOW,
        wrappedVaultKey: body.vault.wrappedVaultKey,
        metadata: body.vault.metadata,
      });
      return Promise.resolve(jsonResponse({ vaultId: body.vault.vaultId, createdAt: NOW }));
    }

    if (url.endsWith("/v1/auth/login/finish")) {
      server.loginCount += 1;
      const failure = server.loginFailures.shift();
      if (failure !== undefined) return Promise.resolve(failureResponse(failure));
      return Promise.resolve(
        jsonResponse({
          accountId: "01J0000000000000000000000A",
          accessToken: { token: "renewed", expiresAt: new Date(NOW_MS + 3_600_000).toISOString() },
          vaults: [...server.vaults.values()].map((vault) => ({
            vaultId: vault.vaultId,
            wrappedVaultKey: vault.wrappedVaultKey,
          })),
        }),
      );
    }

    return Promise.resolve(new Response("{}", { status: 404 }));
  });
};

export const newServer = (): FakeServer => ({
  revision: 0,
  items: new Map(),
  vaults: new Map(),
  pushFailures: [],
  loginFailures: [],
  pushCount: 0,
  loginCount: 0,
});

export const newVaultKey = async (): Promise<CryptoKey> => {
  const rawKey = generateVaultKey();
  assert.ok(rawKey.ok);
  const key = await importVaultKey(rawKey.value);
  assert.ok(key.ok);
  return key.value;
};

export const fakeAccountKeys = (): AccountKeys =>
  ({ authKey: new Uint8Array(32).fill(1), wrappingKey: new Uint8Array(32).fill(2) }) as unknown as AccountKeys;

export const seedVault = async (
  server: FakeServer,
  accountKeys: AccountKeys,
  vaultId: string,
  name: string,
): Promise<CryptoKey> => {
  const created = await createVault(accountKeys.wrappingKey, { vaultId, name, icon: "", color: "", now: NOW });
  assert.ok(created.ok);
  server.vaults.set(vaultId, {
    vaultId,
    version: 1,
    updatedAt: NOW,
    wrappedVaultKey: created.value.payload.wrappedVaultKey,
    metadata: created.value.payload.metadata,
  });
  return created.value.key;
};

export const openAccountSession = async (
  options: { readonly tokenExpiresAtMs?: number; readonly server?: FakeServer } = {},
): Promise<{ readonly key: CryptoKey; readonly server: FakeServer }> => {
  const accountKeys = fakeAccountKeys();
  const server = options.server ?? newServer();
  const key = await seedVault(server, accountKeys, VAULT_ID, "Personal");

  assert.ok(configureApi("https://api.example.test").ok);
  openSession({
    accountId: "account",
    email: "a@example.test",
    accountKeys,
    vaults: [{ vaultId: VAULT_ID, key }],
    token: "token",
    tokenExpiresAtMs: options.tokenExpiresAtMs ?? NOW_MS + 3_600_000,
    nowMs: NOW_MS,
  });

  installFakeServer(server);
  return { key, server };
};
