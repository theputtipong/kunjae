/// <reference types="node" />
import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import { emptyLoginItem, emptySecureNoteItem, type ItemContent } from "@kunjae/domain";

import { NOW, NOW_MS, openAccountSession, VAULT_ID } from "../testing/fake-api.ts";
import { lockSession } from "../session/vault-session.ts";
import { clearStore, getStoreView } from "../store/vault-store.ts";
import { buildVaultExport, encryptExport, importVaultExport } from "./export-vault.ts";

afterEach(() => {
  mock.restoreAll();
  lockSession();
  clearStore();
});

const ITEM_A = "01J000000000000000000000A1";
const ITEM_B = "01J000000000000000000000B1";

const exportOf = (contents: readonly ItemContent[]): string =>
  buildVaultExport({
    email: "a@example.test",
    items: contents.map((content, index) => ({
      itemId: index === 0 ? ITEM_A : ITEM_B,
      vaultId: VAULT_ID,
      version: 1,
      content,
    })),
    vaultNames: new Map([[VAULT_ID, "Personal"]]),
    exportedAt: NOW,
  });

void test("a plain export that mentions the encrypted marker still imports as plain JSON", async () => {
  await openAccountSession();
  const document = exportOf([
    { ...emptySecureNoteItem("note", NOW), notes: 'format "kunjae.export.encrypted"' },
    { ...emptyLoginItem("kunjae.export.encrypted", NOW) },
  ]);

  const imported = await importVaultExport({ document, password: "", vaultId: VAULT_ID, nowMs: NOW_MS });

  assert.deepEqual(imported, { ok: true, value: { added: 2, skipped: 0, invalid: 0, failed: 0 } });
  assert.equal(getStoreView().items.length, 2);
});

void test("an encrypted export needs the right password and then imports", async () => {
  await openAccountSession();
  const plain = exportOf([emptyLoginItem("secret login", NOW)]);
  const encrypted = await encryptExport(plain, "correct horse battery");
  assert.ok(encrypted.ok);
  const document = JSON.stringify(encrypted.value);

  const wrong = await importVaultExport({ document, password: "wrong password!", vaultId: VAULT_ID, nowMs: NOW_MS });
  assert.deepEqual(wrong, { ok: false, error: { kind: "InvalidInput", field: "exportPassword" } });

  const right = await importVaultExport({ document, password: "correct horse battery", vaultId: VAULT_ID, nowMs: NOW_MS });
  assert.deepEqual(right, { ok: true, value: { added: 1, skipped: 0, invalid: 0, failed: 0 } });
});

void test("unknown formats and broken JSON are reported as a bad file", async () => {
  await openAccountSession();
  for (const document of ["{", "[]", JSON.stringify({ format: "other", items: [] }), "null"]) {
    const result = await importVaultExport({ document, password: "", vaultId: VAULT_ID, nowMs: NOW_MS });
    assert.deepEqual(result, { ok: false, error: { kind: "InvalidInput", field: "exportFile" } });
  }
});

void test("import skips duplicates and counts an oversized item as failed without dropping the rest", async () => {
  await openAccountSession();
  const huge: ItemContent = {
    ...emptySecureNoteItem("huge", NOW),
    notes: "ก".repeat(10_000),
    customFields: Array.from({ length: 4 }, () => ({ name: "n", value: "ก".repeat(2048), hidden: false })),
  };
  const document = exportOf([huge, emptyLoginItem("fine", NOW)]);

  const first = await importVaultExport({ document, password: "", vaultId: VAULT_ID, nowMs: NOW_MS });
  assert.deepEqual(first, { ok: true, value: { added: 1, skipped: 0, invalid: 0, failed: 1 } });

  const again = await importVaultExport({ document: exportOf([emptyLoginItem("fine", NOW)]), password: "", vaultId: VAULT_ID, nowMs: NOW_MS });
  assert.deepEqual(again, { ok: true, value: { added: 0, skipped: 1, invalid: 0, failed: 0 } });
});
