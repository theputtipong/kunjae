/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import { decideFill, hostOf, normalizeWebsite, originOf } from "./origin.ts";

void test("originOf accepts only http and https", () => {
  assert.equal(originOf("https://example.com/login?x=1"), "https://example.com");
  assert.equal(originOf("http://example.com:8080/"), "http://example.com:8080");
  assert.equal(originOf("javascript:alert(1)"), null);
  assert.equal(originOf("data:text/html,hi"), null);
  assert.equal(originOf("chrome://settings"), null);
  assert.equal(originOf("file:///etc/passwd"), null);
  assert.equal(originOf("not a url"), null);
  assert.equal(originOf(""), null);
  assert.equal(originOf(undefined), null);
  assert.equal(originOf(null), null);
});

void test("originOf rejects a trailing-dot host", () => {
  assert.equal(originOf("https://example.com./"), null);
});

void test("originOf strips userinfo and punycodes IDN hosts", () => {
  assert.equal(originOf("https://user:pass@example.com/"), "https://example.com");
  assert.equal(originOf("https://ตัวอย่าง.ไทย/"), "https://xn--72c1a1bt4awk9o.xn--o3cw4h");
});

const allowed = (tab: string, saved: string): boolean => decideFill(tab, saved).allowed;

void test("decideFill requires the exact origin", () => {
  assert.equal(allowed("https://example.com/login", "https://example.com/"), true);
  assert.equal(allowed("https://example.com/a", "https://example.com:443/b"), true);
  assert.equal(allowed("http://example.com/", "https://example.com/"), false);
  assert.equal(allowed("https://sub.example.com/", "https://example.com/"), false);
  assert.equal(allowed("https://example.com/", "https://sub.example.com/"), false);
  assert.equal(allowed("https://example.com:8443/", "https://example.com/"), false);
  assert.equal(allowed("https://example.com.evil.test/", "https://example.com/"), false);
  assert.equal(allowed("https://user:pass@evil.test/", "https://evil.test/"), true);
  assert.equal(allowed("https://example.com@evil.test/", "https://example.com/"), false);
});

void test("decideFill reports why it refuses", () => {
  assert.deepEqual(decideFill("https://example.com/", ""), { allowed: false, reason: "no-saved-url" });
  assert.deepEqual(decideFill("https://example.com/", "javascript:alert(1)"), {
    allowed: false,
    reason: "no-saved-url",
  });
  assert.deepEqual(decideFill(undefined, "https://example.com/"), { allowed: false, reason: "no-tab-access" });
  assert.deepEqual(decideFill("", "https://example.com/"), { allowed: false, reason: "no-tab-access" });
  assert.deepEqual(decideFill("chrome://newtab", "https://example.com/"), {
    allowed: false,
    reason: "unsupported-page",
  });
  assert.deepEqual(decideFill("https://example.com./", "https://example.com/"), {
    allowed: false,
    reason: "unsupported-page",
  });
  assert.deepEqual(decideFill("https://evil.test/", "https://example.com/"), {
    allowed: false,
    reason: "origin-mismatch",
    tabOrigin: "https://evil.test",
    savedOrigin: "https://example.com",
  });
  assert.deepEqual(decideFill("https://example.com/x", "https://example.com"), {
    allowed: true,
    origin: "https://example.com",
  });
});

void test("decideFill treats a scheme-less saved address as https", () => {
  assert.equal(allowed("https://github.com/login", "github.com"), true);
  assert.equal(allowed("https://github.com/login", "github.com/login"), true);
  assert.equal(allowed("http://github.com/login", "github.com"), false);
  assert.equal(hostOf("github.com"), "github.com");
});

void test("normalizeWebsite prepends https to scheme-less input", () => {
  assert.equal(normalizeWebsite(""), "");
  assert.equal(normalizeWebsite("   "), "");
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
