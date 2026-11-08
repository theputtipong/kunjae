/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import { emptyLoginItem, ItemContentSchema, validateItemContent, type LoginItem } from "./item-content.ts";
import { loginTotpCode, normalizeItemContent, parseOtpauthUri, totpConfigOf } from "./totp.ts";

const NOW = "2026-01-01T00:00:00.000Z";

const SHA1_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const SHA256_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA";
const SHA512_SECRET =
  "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNA";

const RFC6238: readonly (readonly [number, string, string, string])[] = [
  [59, "94287082", "46119246", "90693936"],
  [1111111109, "07081804", "68084774", "25091201"],
  [1111111111, "14050471", "67062674", "99943326"],
  [1234567890, "89005924", "91819424", "93441116"],
  [2000000000, "69279037", "90698825", "38618901"],
  [20000000000, "65353130", "77737706", "47863826"],
];

const login = (overrides: Partial<LoginItem>): LoginItem => ({ ...emptyLoginItem("Site", NOW), ...overrides });

for (const [seconds, sha1, sha256, sha512] of RFC6238) {
  void test(`RFC 6238 vectors at T=${String(seconds)} through login fields`, () => {
    const nowMs = seconds * 1000;
    const cases: readonly (readonly [LoginItem, string])[] = [
      [login({ totpSecret: SHA1_SECRET, totpDigits: 8 }), sha1],
      [login({ totpSecret: SHA256_SECRET, totpAlgorithm: "SHA256", totpDigits: 8 }), sha256],
      [login({ totpSecret: SHA512_SECRET, totpAlgorithm: "SHA512", totpDigits: 8 }), sha512],
    ];
    for (const [item, expected] of cases) {
      const code = loginTotpCode(item, nowMs);
      assert.ok(code.ok);
      assert.equal(code.value.code, expected);
    }
  });

  void test(`RFC 6238 vectors at T=${String(seconds)} through otpauth URIs`, () => {
    const nowMs = seconds * 1000;
    const cases: readonly (readonly [string, string])[] = [
      [`otpauth://totp/Ex:a@b?secret=${SHA1_SECRET}&digits=8`, sha1],
      [`otpauth://totp/Ex:a@b?secret=${SHA256_SECRET}&algorithm=SHA256&digits=8`, sha256],
      [`otpauth://totp/Ex:a@b?secret=${SHA512_SECRET}&algorithm=sha512&digits=8&period=30`, sha512],
    ];
    for (const [uri, expected] of cases) {
      const code = loginTotpCode(login({ totpSecret: uri }), nowMs);
      assert.ok(code.ok);
      assert.equal(code.value.code, expected);
    }
  });
}

void test("old login with plain base32 secret and no TOTP fields still decodes and uses SHA1/6/30", () => {
  const old = {
    type: "login",
    title: "Old",
    notes: "",
    tags: [],
    favorite: false,
    customFields: [],
    createdAt: NOW,
    updatedAt: NOW,
    username: "",
    password: "",
    urls: [],
    totpSecret: SHA1_SECRET,
  };
  const parsed = ItemContentSchema.safeParse(old);
  assert.ok(parsed.success);
  assert.ok(parsed.data.type === "login");

  const code = loginTotpCode(parsed.data, 59_000);
  assert.ok(code.ok);
  assert.equal(code.value.code, "287082");
  assert.equal(code.value.secondsRemaining, 1);
});

void test("parseOtpauthUri reads secret, algorithm, digits and period", () => {
  const parsed = parseOtpauthUri(
    "otpauth://totp/ACME%20Co:john@example.com?secret=jbsw%20y3dp-ehpk3pxp&issuer=ACME%20Co&algorithm=SHA256&digits=8&period=60",
  );
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.value, {
    secret: "JBSWY3DPEHPK3PXP",
    algorithm: "SHA256",
    digits: 8,
    periodSeconds: 60,
  });
});

void test("parseOtpauthUri uses defaults when parameters are missing", () => {
  const parsed = parseOtpauthUri("OTPAUTH://TOTP/label?secret=JBSWY3DPEHPK3PXP");
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.value, { secret: "JBSWY3DPEHPK3PXP", algorithm: "SHA1", digits: 6, periodSeconds: 30 });
});

const invalidUris: readonly string[] = [
  "otpauth://hotp/label?secret=JBSWY3DPEHPK3PXP&counter=1",
  "otpauth://totp/label",
  "otpauth://totp/label?issuer=x",
  "otpauth://totp/label?secret=",
  "otpauth://totp/label?secret=JBSWY3DP!",
  "otpauth://totp/label?secret=JBSWY3DPEHPK3PXP&algorithm=MD5",
  "otpauth://totp/label?secret=JBSWY3DPEHPK3PXP&digits=5",
  "otpauth://totp/label?secret=JBSWY3DPEHPK3PXP&digits=9",
  "otpauth://totp/label?secret=JBSWY3DPEHPK3PXP&digits=six",
  "otpauth://totp/label?secret=JBSWY3DPEHPK3PXP&period=0",
  "otpauth://totp/label?secret=JBSWY3DPEHPK3PXP&period=301",
  "otpauth://totp/label?secret=%ZZ",
  "https://example.com/?secret=JBSWY3DPEHPK3PXP",
];

for (const uri of invalidUris) {
  void test(`parseOtpauthUri rejects ${uri}`, () => {
    assert.ok(!parseOtpauthUri(uri).ok);
  });
}

void test("normalizeItemContent turns an otpauth URI into secret plus non-default fields", () => {
  const normalized = normalizeItemContent(
    login({ totpSecret: "otpauth://totp/x?secret=JBSWY3DPEHPK3PXP&algorithm=SHA512&digits=8&period=30" }),
  );
  assert.ok(normalized.ok);
  assert.ok(normalized.value.type === "login");
  assert.equal(normalized.value.totpSecret, "JBSWY3DPEHPK3PXP");
  assert.equal(normalized.value.totpAlgorithm, "SHA512");
  assert.equal(normalized.value.totpDigits, 8);
  assert.ok(!("totpPeriod" in normalized.value));
});

void test("normalizeItemContent drops old fields when a default URI replaces them", () => {
  const normalized = normalizeItemContent(
    login({
      totpSecret: "otpauth://totp/x?secret=JBSWY3DPEHPK3PXP",
      totpAlgorithm: "SHA256",
      totpDigits: 8,
      totpPeriod: 60,
    }),
  );
  assert.ok(normalized.ok);
  assert.ok(!("totpAlgorithm" in normalized.value));
  assert.ok(!("totpDigits" in normalized.value));
  assert.ok(!("totpPeriod" in normalized.value));
});

void test("normalizeItemContent reports totpSecret for a broken URI and leaves plain secrets alone", () => {
  const broken = normalizeItemContent(login({ totpSecret: "otpauth://totp/x?secret=!!" }));
  assert.deepEqual(broken, { ok: false, error: { kind: "ItemContentInvalid", fields: ["totpSecret"] } });

  const plain = login({ totpSecret: "jbsw y3dp", totpPeriod: 60 });
  const kept = normalizeItemContent(plain);
  assert.ok(kept.ok);
  assert.deepEqual(kept.value, plain);
});

void test("schema bounds the new TOTP fields", () => {
  const fieldsOf = (item: LoginItem): readonly string[] => {
    const result = validateItemContent(item);
    if (result.ok) return [];
    return result.error.kind === "ItemContentInvalid" ? result.error.fields : [result.error.kind];
  };
  assert.deepEqual(fieldsOf(login({ totpDigits: 6, totpPeriod: 15, totpAlgorithm: "SHA1" })), []);
  assert.deepEqual(fieldsOf(login({ totpDigits: 8, totpPeriod: 300 })), []);
  assert.deepEqual(fieldsOf(login({ totpDigits: 5 })), ["totpDigits"]);
  assert.deepEqual(fieldsOf(login({ totpDigits: 9 })), ["totpDigits"]);
  assert.deepEqual(fieldsOf(login({ totpDigits: 6.5 })), ["totpDigits"]);
  assert.deepEqual(fieldsOf(login({ totpPeriod: 14 })), ["totpPeriod"]);
  assert.deepEqual(fieldsOf(login({ totpPeriod: 301 })), ["totpPeriod"]);
  assert.deepEqual(
    fieldsOf({ ...login({}), totpAlgorithm: "MD5" } as unknown as LoginItem),
    ["totpAlgorithm"],
  );
});

void test("totpConfigOf prefers URI parameters over stored fields", () => {
  const config = totpConfigOf(
    login({ totpSecret: "otpauth://totp/x?secret=JBSWY3DPEHPK3PXP&digits=8", totpDigits: 6, totpPeriod: 60 }),
  );
  assert.ok(config.ok);
  assert.deepEqual(config.value, { secret: "JBSWY3DPEHPK3PXP", algorithm: "SHA1", digits: 8, periodSeconds: 30 });
});

void test("loginTotpCode reports an unreadable secret", () => {
  assert.ok(!loginTotpCode(login({ totpSecret: "not base32!" }), 0).ok);
  assert.ok(!loginTotpCode(login({ totpSecret: "otpauth://totp/x?secret=" }), 0).ok);
});
