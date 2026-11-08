/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeWebsite } from "./website.ts";

void test("normalizeWebsite prepends https to scheme-less input", () => {
  assert.equal(normalizeWebsite(""), "");
  assert.equal(normalizeWebsite("  "), "");
  assert.equal(normalizeWebsite("github.com"), "https://github.com");
  assert.equal(normalizeWebsite(" github.com/login "), "https://github.com/login");
  assert.equal(normalizeWebsite("localhost:8080"), "https://localhost:8080");
  assert.equal(normalizeWebsite("https://example.com/a"), "https://example.com/a");
  assert.equal(normalizeWebsite("http://example.com"), "http://example.com");
  assert.equal(normalizeWebsite("android-app://com.example"), "android-app://com.example");
});

void test("normalizeWebsite rejects input that is not an address", () => {
  assert.equal(normalizeWebsite("my bank"), null);
  assert.equal(normalizeWebsite("javascript:alert(1)"), null);
  assert.equal(normalizeWebsite("mailto:me@example.com"), null);
});
