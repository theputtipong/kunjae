/// <reference types="node" />
import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import { emptyLoginItem, emptySecureNoteItem } from "@kunjae/domain";

import { NOW, NOW_MS, openAccountSession, VAULT_ID } from "../testing/fake-api.ts";
import { lockSession } from "../session/vault-session.ts";
import { clearStore, getItemRef, getStoreView } from "../store/vault-store.ts";
import { saveItem } from "../services/sync.ts";
import { createNewVault } from "../services/vaults.ts";
import { configureLocalPersistence, createMemoryPersistence } from "./persistence.ts";
import { createLocalVault, getLocalVaultSummary, migrateLocalToAccount } from "./local-vault.ts";

const DEVICE_PASSWORD = "device password 123";
const PERSONAL_ITEM = "01J00000000000000000000P01";
const PERSONAL_NOTE = "01J00000000000000000000P02";
const WORK_ITEM = "01J00000000000000000000W01";

afterEach(() => {
  mock.restoreAll();
  lockSession();
  clearStore();
});

const seedLocalVault = async (): Promise<void> => {
  configureLocalPersistence(createMemoryPersistence());
  assert.ok((await createLocalVault({ masterPassword: DEVICE_PASSWORD, lang: "en", nowMs: NOW_MS })).ok);

  const personal = getStoreView().vaults[0]?.vaultId;
  assert.ok(personal !== undefined);
  const work = await createNewVault({ name: "Work", nowMs: NOW_MS });
  assert.ok(work.ok);

  const save = async (itemId: string, vaultId: string, title: string, note = false) => {
    const content = note ? emptySecureNoteItem(title, NOW) : emptyLoginItem(title, NOW);
    assert.ok((await saveItem({ itemId, vaultId, content, baseVersion: 0, nowMs: NOW_MS })).ok);
  };
  await save(PERSONAL_ITEM, personal, "bank");
  await save(PERSONAL_NOTE, personal, "wifi", true);
  await save(WORK_ITEM, work.value, "jira");

  lockSession();
};

const vaultNameOf = (vaultId: string | undefined): string | undefined =>
  getStoreView().vaults.find((vault) => vault.vaultId === vaultId)?.name;

void test("migration keeps each local vault separate and reuses item ids", async () => {
  await seedLocalVault();
  const { server } = await openAccountSession();

  const migrated = await migrateLocalToAccount({ devicePassword: DEVICE_PASSWORD, nowMs: NOW_MS });

  assert.deepEqual(migrated, { ok: true, value: { moved: 3, failed: 0, cleared: true } });
  assert.equal(server.vaults.size, 2);
  assert.equal(server.items.size, 3);

  assert.equal(getItemRef(PERSONAL_ITEM)?.vaultId, VAULT_ID);
  assert.equal(getItemRef(PERSONAL_NOTE)?.vaultId, VAULT_ID);
  const workVault = getItemRef(WORK_ITEM)?.vaultId;
  assert.notEqual(workVault, VAULT_ID);
  assert.equal(vaultNameOf(workVault), "Work");

  const summary = await getLocalVaultSummary();
  assert.deepEqual(summary, { ok: true, value: null });
});

void test("retrying after a lost push response creates no duplicates", async () => {
  await seedLocalVault();
  const { server } = await openAccountSession();
  server.pushFailures.push({ status: 503, code: "UNAVAILABLE", afterApply: true });

  const first = await migrateLocalToAccount({ devicePassword: DEVICE_PASSWORD, nowMs: NOW_MS });
  assert.deepEqual(first, { ok: false, error: { kind: "ServiceUnavailable" } });
  assert.equal(server.items.size, 2);

  const summary = await getLocalVaultSummary();
  assert.ok(summary.ok);
  assert.ok(summary.value !== null);

  clearStore();
  const retry = await migrateLocalToAccount({ devicePassword: DEVICE_PASSWORD, nowMs: NOW_MS + 1000 });

  assert.ok(retry.ok);
  assert.equal(retry.value.failed, 0);
  assert.equal(retry.value.cleared, true);
  assert.equal(retry.value.moved, 3);
  assert.equal(server.items.size, 3);
  assert.equal(server.vaults.size, 2);
  assert.equal(getStoreView().items.length, 3);
});

void test("a partial failure keeps only unmoved items on the device and a retry finishes", async () => {
  await seedLocalVault();
  const { server } = await openAccountSession();
  server.pushFailures.push(null, { status: 503, code: "UNAVAILABLE" });

  const first = await migrateLocalToAccount({ devicePassword: DEVICE_PASSWORD, nowMs: NOW_MS });
  assert.deepEqual(first, { ok: true, value: { moved: 2, failed: 1, cleared: false } });

  const summary = await getLocalVaultSummary();
  assert.ok(summary.ok);
  assert.equal(summary.value?.itemCount, 1);

  const retry = await migrateLocalToAccount({ devicePassword: DEVICE_PASSWORD, nowMs: NOW_MS + 1000 });
  assert.deepEqual(retry, { ok: true, value: { moved: 1, failed: 0, cleared: true } });
  assert.equal(server.items.size, 3);
  assert.equal(server.vaults.size, 2);
  assert.equal(vaultNameOf(getItemRef(WORK_ITEM)?.vaultId), "Work");
});

void test("an explicit target vault still merges everything into it", async () => {
  await seedLocalVault();
  const { server } = await openAccountSession();

  const migrated = await migrateLocalToAccount({ devicePassword: DEVICE_PASSWORD, nowMs: NOW_MS, targetVaultId: VAULT_ID });

  assert.deepEqual(migrated, { ok: true, value: { moved: 3, failed: 0, cleared: true } });
  assert.equal(server.vaults.size, 1);
  assert.equal(getItemRef(WORK_ITEM)?.vaultId, VAULT_ID);
});

void test("a wrong device password moves nothing", async () => {
  await seedLocalVault();
  const { server } = await openAccountSession();

  const migrated = await migrateLocalToAccount({ devicePassword: "not the password", nowMs: NOW_MS });

  assert.deepEqual(migrated, { ok: false, error: { kind: "WrongDevicePassword" } });
  assert.equal(server.items.size, 0);
});
