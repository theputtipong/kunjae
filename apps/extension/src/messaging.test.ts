/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import { requiresUnlockedSession } from "./messaging.ts";

void test("requests that touch vault items need an unlocked session", () => {
  for (const kind of ["list", "reveal", "totp", "load-for-edit", "save", "fill", "fill-totp"] as const) {
    assert.equal(requiresUnlockedSession(kind), true, kind);
  }
});

void test("status, unlock and local-vault management work while locked", () => {
  for (const kind of [
    "status",
    "unlock",
    "lock",
    "sign-up",
    "local-status",
    "local-create",
    "local-unlock",
    "local-delete",
    "local-dismiss-migration",
    "clear-clipboard-later",
  ] as const) {
    assert.equal(requiresUnlockedSession(kind), false, kind);
  }
});
