/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";

import { drizzle } from "drizzle-orm/d1";

import * as schema from "../db/schema.ts";
import type { Db } from "../db/client.ts";
import type { Deps } from "./deps.ts";
import { syncPull } from "./sync.ts";

type StoredItem = {
  readonly itemId: string;
  readonly vaultId: string;
  readonly version: number;
  readonly revision: number;
};

type FakeState = {
  revision: number;
  items: StoredItem[];
};

const toRaw = (item: StoredItem): unknown[] => [
  item.itemId,
  item.vaultId,
  item.version,
  1,
  null,
  item.revision,
  "2026-01-01T00:00:00.000Z",
];

const createFakeDb = (state: FakeState, afterItemsListed: () => void): Db => {
  const d1 = {
    prepare: (query: string) => ({
      bind: (...params: unknown[]) => ({
        raw: (): Promise<unknown[][]> => {
          if (query.includes(`from "accounts"`)) return Promise.resolve([[state.revision]]);
          if (query.includes(`from "vaults"`)) return Promise.resolve([]);
          if (query.includes(`from "items"`)) {
            const since = Number(params[1]);
            const limit = Number(params[2]);
            const rows = state.items
              .filter((item) => item.revision > since)
              .sort((a, b) => a.revision - b.revision)
              .slice(0, limit)
              .map(toRaw);
            afterItemsListed();
            return Promise.resolve(rows);
          }
          return Promise.reject(new Error(`unexpected query: ${query}`));
        },
      }),
    }),
  };

  return drizzle(d1 as unknown as D1Database, { schema });
};

const depsFor = (db: Db): Deps => ({
  db,
  secrets: {} as Deps["secrets"],
  nowMs: 0,
});

void test("syncPull does not skip an item committed between listing items and reading the revision", async () => {
  const state: FakeState = {
    revision: 1,
    items: [{ itemId: "item-a", vaultId: "vault-1", version: 1, revision: 1 }],
  };

  let concurrentWriteDone = false;
  const db = createFakeDb(state, () => {
    if (concurrentWriteDone) return;
    concurrentWriteDone = true;
    state.revision = 2;
    state.items.push({ itemId: "item-b", vaultId: "vault-1", version: 1, revision: 2 });
  });

  const first = await syncPull(depsFor(db), "account-1", { since: 0 });
  assert.ok(first.ok);
  assert.equal(first.value.hasMore, false);

  const second = await syncPull(depsFor(db), "account-1", { since: first.value.revision });
  assert.ok(second.ok);

  const pulled = new Set([...first.value.items, ...second.value.items].map((item) => item.itemId));
  assert.ok(pulled.has("item-b"));
});

void test("syncPull returns the revision read before listing when nothing changes", async () => {
  const state: FakeState = {
    revision: 3,
    items: [
      { itemId: "item-a", vaultId: "vault-1", version: 1, revision: 2 },
      { itemId: "item-b", vaultId: "vault-1", version: 1, revision: 3 },
    ],
  };
  const db = createFakeDb(state, () => undefined);

  const result = await syncPull(depsFor(db), "account-1", { since: 1 });
  assert.ok(result.ok);
  assert.equal(result.value.hasMore, false);
  assert.equal(result.value.revision, 3);
  assert.deepEqual(
    result.value.items.map((item) => item.itemId),
    ["item-a", "item-b"],
  );
});
