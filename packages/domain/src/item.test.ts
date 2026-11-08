/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import { generateVaultKey, importVaultKey } from "@kunjae/core-crypto";

import { createItem, openItem, updateItem } from "./item.ts";
import { emptyCardItem, type CardItem } from "./item-content.ts";

const ITEM_ID = "01J00000000000000000000001";
const VAULT_ID = "01J00000000000000000000000";
const NOW = "2026-01-01T00:00:00.000Z";

const vaultKey = async (): Promise<CryptoKey> => {
  const raw = generateVaultKey();
  assert.ok(raw.ok);
  const key = await importVaultKey(raw.value);
  assert.ok(key.ok);
  return key.value;
};

const card = (overrides: Partial<CardItem>): CardItem => ({ ...emptyCardItem("Card", NOW), ...overrides });

const invalidContents: readonly [string, CardItem][] = [
  ["expiryMonth", card({ expiryMonth: "1" })],
  ["title", card({ title: "" })],
];

for (const [field, content] of invalidContents) {
  void test(`createItem rejects invalid ${field}`, async () => {
    const result = await createItem(await vaultKey(), { itemId: ITEM_ID, vaultId: VAULT_ID, content, now: NOW });
    assert.ok(!result.ok);
    assert.equal(result.error.kind, "ItemContentInvalid");
    assert.ok(result.error.fields.includes(field));
  });

  void test(`updateItem rejects invalid ${field}`, async () => {
    const result = await updateItem(
      await vaultKey(),
      { itemId: ITEM_ID, vaultId: VAULT_ID, version: 1 },
      content,
      NOW,
    );
    assert.ok(!result.ok);
    assert.equal(result.error.kind, "ItemContentInvalid");
    assert.ok(result.error.fields.includes(field));
  });
}

void test("createItem and updateItem accept valid content that opens again", async () => {
  const key = await vaultKey();
  const valid = card({ expiryMonth: "01", expiryYear: "2030" });

  const created = await createItem(key, { itemId: ITEM_ID, vaultId: VAULT_ID, content: valid, now: NOW });
  assert.ok(created.ok);
  assert.equal(created.value.deleted, false);

  const updated = await updateItem(key, { itemId: ITEM_ID, vaultId: VAULT_ID, version: 1 }, valid, NOW);
  assert.ok(updated.ok);
  assert.ok(!updated.value.deleted);

  const opened = await openItem(key, { ...updated.value, deleted: false, updatedAt: NOW });
  assert.ok(opened.ok);
  assert.equal(opened.value.content.title, "Card");
});
