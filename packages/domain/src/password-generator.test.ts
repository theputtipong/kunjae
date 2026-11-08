/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CHARSETS,
  DEFAULT_PASSWORD_OPTIONS,
  PASSWORD_LENGTH,
  estimateEntropyBits,
  generatePassword,
  type PasswordOptions,
} from "./password-generator.ts";

const containsAny = (text: string, set: string): boolean => {
  for (let i = 0; i < set.length; i += 1) {
    if (text.includes(set.charAt(i))) return true;
  }
  return false;
};

const options = (overrides: Partial<PasswordOptions>): PasswordOptions => ({ ...DEFAULT_PASSWORD_OPTIONS, ...overrides });

void test("generatePassword honours length bounds", () => {
  for (const length of [PASSWORD_LENGTH.min, PASSWORD_LENGTH.default, PASSWORD_LENGTH.max]) {
    const generated = generatePassword(options({ length }));
    assert.ok(generated.ok);
    assert.equal(generated.value.length, length);
  }
  for (const length of [PASSWORD_LENGTH.min - 1, PASSWORD_LENGTH.max + 1, 12.5, Number.NaN]) {
    assert.ok(!generatePassword(options({ length })).ok);
  }
});

void test("generatePassword includes every selected set when requireEachSet is on", () => {
  for (let round = 0; round < 200; round += 1) {
    const generated = generatePassword(options({ length: PASSWORD_LENGTH.min }));
    assert.ok(generated.ok);
    for (const set of Object.values(CHARSETS)) {
      assert.ok(containsAny(generated.value, set), `missing a char from ${set}`);
    }
  }
});

void test("generatePassword only uses selected sets and skips ambiguous characters", () => {
  for (let round = 0; round < 100; round += 1) {
    const digitsOnly = generatePassword(
      options({ lowercase: false, uppercase: false, symbols: false, excludeAmbiguous: true, length: 64 }),
    );
    assert.ok(digitsOnly.ok);
    assert.match(digitsOnly.value, /^[2-9]+$/u);
  }
});

void test("generatePassword rejects an empty selection", () => {
  assert.ok(!generatePassword(options({ lowercase: false, uppercase: false, digits: false, symbols: false })).ok);
});

void test("estimateEntropyBits matches length * log2(charset) without requireEachSet", () => {
  const bits = estimateEntropyBits(
    options({ length: 10, uppercase: false, symbols: false, digits: false, requireEachSet: false }),
  );
  assert.ok(Math.abs(bits - 10 * Math.log2(26)) < 1e-9);
});

void test("estimateEntropyBits is slightly lower with requireEachSet and zero for no sets", () => {
  const free = estimateEntropyBits(options({ requireEachSet: false }));
  const required = estimateEntropyBits(options({}));
  assert.ok(required < free);
  assert.ok(required > free - 1);
  assert.equal(estimateEntropyBits(options({ lowercase: false, uppercase: false, digits: false, symbols: false })), 0);
});
