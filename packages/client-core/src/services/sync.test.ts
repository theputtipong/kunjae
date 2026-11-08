/// <reference types="node" />
import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import { createItem, emptyLoginItem, updateItem, updateVaultMetadata, type LoginItem } from "@kunjae/domain";

import {
  applyOnServer,
  NOW,
  NOW_MS,
  openAccountSession,
  putRecordOnServer,
  toRecord,
  VAULT_ID,
} from "../testing/fake-api.ts";
import { getSessionView, lockSession } from "../session/vault-session.ts";
import { clearStore, getItemContent, getItemRef, getStoreView } from "../store/vault-store.ts";
import { pull, saveItem, saveNewItems } from "./sync.ts";

const REMOTE_ITEM_ID = "01J00000000000000000000001";
const LOCAL_ITEM_ID = "01J00000000000000000000002";

const itemId = (n: number): string => `01J0000000000000000000${String(n).padStart(4, "0")}`;

afterEach(() => {
  mock.restoreAll();
  lockSession();
  clearStore();
});

void test("pull still fetches a second device's change that landed before a local push", async () => {
  const { key, server } = await openAccountSession();

  const created = await createItem(key, {
    itemId: REMOTE_ITEM_ID,
    vaultId: VAULT_ID,
    content: emptyLoginItem("remote v1", NOW),
    now: NOW,
  });
  assert.ok(created.ok);
  applyOnServer(server, created.value);

  assert.ok((await pull(NOW_MS)).ok);
  assert.equal(getItemContent(REMOTE_ITEM_ID)?.title, "remote v1");

  const updatedElsewhere = await updateItem(
    key,
    { itemId: REMOTE_ITEM_ID, vaultId: VAULT_ID, version: created.value.version },
    emptyLoginItem("remote v2", NOW),
    NOW,
  );
  assert.ok(updatedElsewhere.ok);
  applyOnServer(server, updatedElsewhere.value);

  const saved = await saveItem({
    itemId: LOCAL_ITEM_ID,
    vaultId: VAULT_ID,
    content: emptyLoginItem("local", NOW),
    baseVersion: 0,
    nowMs: NOW_MS,
  });
  assert.ok(saved.ok);

  assert.ok((await pull(NOW_MS)).ok);
  assert.equal(getItemContent(REMOTE_ITEM_ID)?.title, "remote v2");
  assert.equal(getItemContent(LOCAL_ITEM_ID)?.title, "local");
});

void test("saveItem returns InvalidInput for invalid content and pushes nothing", async () => {
  const { server } = await openAccountSession();

  const saved = await saveItem({
    itemId: LOCAL_ITEM_ID,
    vaultId: VAULT_ID,
    content: emptyLoginItem("", NOW),
    baseVersion: 0,
    nowMs: NOW_MS,
  });

  assert.deepEqual(saved, { ok: false, error: { kind: "InvalidInput", field: "title" } });
  assert.equal(server.revision, 0);
  assert.equal(getItemContent(LOCAL_ITEM_ID), null);
});

void test("saving with a stale base version returns Conflict and loads the newer server copy", async () => {
  const { key, server } = await openAccountSession();

  const created = await createItem(key, {
    itemId: REMOTE_ITEM_ID,
    vaultId: VAULT_ID,
    content: emptyLoginItem("v1", NOW),
    now: NOW,
  });
  assert.ok(created.ok);
  applyOnServer(server, created.value);
  assert.ok((await pull(NOW_MS)).ok);

  const elsewhere = await updateItem(key, { itemId: REMOTE_ITEM_ID, vaultId: VAULT_ID, version: 1 }, emptyLoginItem("v2 elsewhere", NOW), NOW);
  assert.ok(elsewhere.ok);
  applyOnServer(server, elsewhere.value);

  const saved = await saveItem({
    itemId: REMOTE_ITEM_ID,
    vaultId: VAULT_ID,
    content: emptyLoginItem("v2 here", NOW),
    baseVersion: 1,
    nowMs: NOW_MS,
  });

  assert.deepEqual(saved, { ok: false, error: { kind: "Conflict" } });
  assert.equal(getItemContent(REMOTE_ITEM_ID)?.title, "v2 elsewhere");
  assert.equal(getItemRef(REMOTE_ITEM_ID)?.version, 2);
});

void test("pull ignores an item the server rolls back to an older version", async () => {
  const { key, server } = await openAccountSession();

  const v1 = await createItem(key, { itemId: REMOTE_ITEM_ID, vaultId: VAULT_ID, content: emptyLoginItem("old password", NOW), now: NOW });
  assert.ok(v1.ok);
  const v2 = await updateItem(key, { itemId: REMOTE_ITEM_ID, vaultId: VAULT_ID, version: 1 }, emptyLoginItem("new password", NOW), NOW);
  assert.ok(v2.ok);

  applyOnServer(server, v1.value);
  applyOnServer(server, v2.value);
  assert.ok((await pull(NOW_MS)).ok);
  assert.equal(getItemRef(REMOTE_ITEM_ID)?.version, 2);

  const v1Record = toRecord(v1.value);
  putRecordOnServer(server, v1Record);
  putRecordOnServer(server, {
    itemId: REMOTE_ITEM_ID,
    vaultId: VAULT_ID,
    version: 1,
    updatedAt: NOW,
    deleted: true,
  });
  putRecordOnServer(server, v1Record);

  assert.ok((await pull(NOW_MS)).ok);
  assert.equal(getItemContent(REMOTE_ITEM_ID)?.title, "new password");
  assert.equal(getItemRef(REMOTE_ITEM_ID)?.version, 2);
});

void test("pull ignores a vault the server rolls back to an older metadata version", async () => {
  const { key, server } = await openAccountSession();
  assert.ok((await pull(NOW_MS)).ok);

  const original = server.vaults.get(VAULT_ID);
  assert.ok(original !== undefined);

  const renamed = await updateVaultMetadata(
    key,
    { vaultId: VAULT_ID, version: 1 },
    { name: "Renamed", icon: "", color: "" },
    { name: "Personal", icon: "", color: "", createdAt: NOW, updatedAt: NOW },
    NOW,
  );
  assert.ok(renamed.ok);
  server.vaults.set(VAULT_ID, { ...original, version: renamed.value.version, metadata: renamed.value.metadata });
  assert.ok((await pull(NOW_MS)).ok);
  assert.equal(getStoreView().vaults[0]?.name, "Renamed");

  server.vaults.set(VAULT_ID, original);
  assert.ok((await pull(NOW_MS)).ok);
  assert.equal(getStoreView().vaults[0]?.name, "Renamed");
});

void test("saveNewItems skips an oversized item, keeps going and reports the real saved count", async () => {
  const { server } = await openAccountSession();

  const huge: LoginItem = {
    ...emptyLoginItem("huge", NOW),
    notes: "ก".repeat(10_000),
    customFields: Array.from({ length: 4 }, () => ({ name: "n", value: "ก".repeat(2048), hidden: false })),
  };

  const items = Array.from({ length: 120 }, (_, i) => ({
    itemId: itemId(i + 10),
    content: i === 70 ? huge : emptyLoginItem(`item ${String(i)}`, NOW),
  }));

  const saved = await saveNewItems(VAULT_ID, items, NOW_MS);

  assert.deepEqual(saved, { ok: true, value: 119 });
  assert.equal(server.items.size, 119);
  assert.equal(getItemRef(itemId(80)), null);
  assert.equal(server.items.has(itemId(80)), false);
  assert.equal(getItemContent(itemId(81))?.title, "item 71");
  assert.equal(getItemContent(itemId(129))?.title, "item 119");
});

void test("saveItem stores an otpauth URI as secret plus parameters", async () => {
  await openAccountSession();

  const saved = await saveItem({
    itemId: LOCAL_ITEM_ID,
    vaultId: VAULT_ID,
    content: { ...emptyLoginItem("2fa", NOW), totpSecret: "otpauth://totp/x?secret=jbswy3dpehpk3pxp&digits=8&period=60" },
    baseVersion: 0,
    nowMs: NOW_MS,
  });
  assert.ok(saved.ok);

  const local = getItemContent(LOCAL_ITEM_ID);
  assert.ok(local?.type === "login");
  assert.equal(local.totpSecret, "JBSWY3DPEHPK3PXP");
  assert.equal(local.totpDigits, 8);
  assert.equal(local.totpPeriod, 60);

  clearStore();
  assert.ok((await pull(NOW_MS)).ok);
  const pulled = getItemContent(LOCAL_ITEM_ID);
  assert.deepEqual(pulled, local);
});

void test("lockSession clears decrypted items from the store", async () => {
  await openAccountSession();

  assert.ok(
    (await saveItem({ itemId: LOCAL_ITEM_ID, vaultId: VAULT_ID, content: emptyLoginItem("secret", NOW), baseVersion: 0, nowMs: NOW_MS })).ok,
  );
  assert.equal(getItemContent(LOCAL_ITEM_ID)?.title, "secret");

  lockSession();

  assert.equal(getSessionView().status, "locked");
  assert.equal(getItemContent(LOCAL_ITEM_ID), null);
  assert.equal(getStoreView().items.length, 0);
});

void test("a server UNAUTHORIZED during sync locks the session and clears decrypted items", async () => {
  const { server } = await openAccountSession();
  assert.ok(
    (await saveItem({ itemId: LOCAL_ITEM_ID, vaultId: VAULT_ID, content: emptyLoginItem("secret", NOW), baseVersion: 0, nowMs: NOW_MS })).ok,
  );

  server.pushFailures.push({ status: 401, code: "UNAUTHORIZED" });
  const saved = await saveItem({ itemId: REMOTE_ITEM_ID, vaultId: VAULT_ID, content: emptyLoginItem("other", NOW), baseVersion: 0, nowMs: NOW_MS });

  assert.deepEqual(saved, { ok: false, error: { kind: "SessionExpired" } });
  assert.equal(getSessionView().status, "locked");
  assert.equal(getItemContent(LOCAL_ITEM_ID), null);
});

void test("a lock that lands while a push is in flight does not put plaintext back", async () => {
  const { server } = await openAccountSession();
  const realFetch = globalThis.fetch;
  mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const response = await realFetch(input, init);
    lockSession();
    return response;
  });

  await saveItem({ itemId: LOCAL_ITEM_ID, vaultId: VAULT_ID, content: emptyLoginItem("secret", NOW), baseVersion: 0, nowMs: NOW_MS });

  assert.equal(server.items.size, 1);
  assert.equal(getItemContent(LOCAL_ITEM_ID), null);
});
