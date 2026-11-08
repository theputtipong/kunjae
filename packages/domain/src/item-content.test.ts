/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ITEM_TYPES,
  MAX_ITEM_CONTENT_BYTES,
  decodeItemContent,
  emptyItemOfType,
  encodeItemContent,
  type ItemContent,
} from "./item-content.ts";

const NOW = "2026-01-01T00:00:00.000Z";

const richItem = (type: (typeof ITEM_TYPES)[number]): ItemContent => {
  const base = {
    ...emptyItemOfType(type, `ชื่อ ${type}`, NOW),
    notes: "บันทึก",
    tags: ["งาน"],
    favorite: true,
    customFields: [{ name: "pin", value: "1234", hidden: true }],
  };
  switch (base.type) {
    case "login":
      return { ...base, username: "me", password: "pw", urls: ["https://example.com"], totpSecret: "JBSWY3DPEHPK3PXP" };
    case "card":
      return { ...base, cardholderName: "A", number: "4242424242424242", expiryMonth: "01", expiryYear: "2030", securityCode: "123" };
    case "secure-note":
      return base;
  }
};

for (const type of ITEM_TYPES) {
  void test(`encode then decode round-trips a ${type} item`, () => {
    const item = richItem(type);
    const bytes = encodeItemContent(item);
    assert.ok(bytes.ok);
    const decoded = decodeItemContent(bytes.value);
    assert.ok(decoded.ok);
    assert.deepEqual(decoded.value, item);
  });
}

void test("login with TOTP fields round-trips", () => {
  const item = { ...richItem("login"), totpAlgorithm: "SHA256", totpDigits: 8, totpPeriod: 60 } as ItemContent;
  const bytes = encodeItemContent(item);
  assert.ok(bytes.ok);
  const decoded = decodeItemContent(bytes.value);
  assert.ok(decoded.ok);
  assert.deepEqual(decoded.value, item);
});

void test("decode rejects unknown fields and invalid JSON", () => {
  const withExtra = new TextEncoder().encode(JSON.stringify({ ...richItem("secure-note"), extra: 1 }));
  assert.ok(!decodeItemContent(withExtra).ok);
  assert.ok(!decodeItemContent(new TextEncoder().encode("{")).ok);
});

void test("encode rejects content over the byte limit", () => {
  const big: ItemContent = {
    ...richItem("secure-note"),
    notes: "ก".repeat(10_000),
    customFields: Array.from({ length: 4 }, () => ({ name: "n", value: "ก".repeat(2048), hidden: false })),
  };
  const bytes = encodeItemContent(big);
  assert.ok(!bytes.ok);
  assert.ok(bytes.error.kind === "ItemContentTooLarge");
  assert.ok(bytes.error.actualBytes > MAX_ITEM_CONTENT_BYTES);
});
