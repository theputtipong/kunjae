/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";

import { createTestDatabase } from "../testing/sqlite-d1.ts";
import { touchRateLimit } from "./rate-limit.ts";

const WINDOW = 60;
const LIMIT = 3;

void test("touchRateLimit allows up to the cap then blocks within the window", async () => {
  const { db } = createTestDatabase();

  const outcomes: boolean[] = [];
  for (let i = 0; i < LIMIT + 2; i += 1) {
    const state = await touchRateLimit(db, "bucket", 1000 + i, WINDOW, LIMIT);
    assert.ok(state.ok);
    outcomes.push(state.value.allowed);
  }

  assert.deepEqual(outcomes, [true, true, true, false, false]);
});

void test("touchRateLimit resets the counter once the window elapses", async () => {
  const { db } = createTestDatabase();

  for (let i = 0; i < LIMIT; i += 1) {
    const state = await touchRateLimit(db, "bucket", 1000, WINDOW, LIMIT);
    assert.ok(state.ok && state.value.allowed);
  }

  const blocked = await touchRateLimit(db, "bucket", 1000 + WINDOW - 1, WINDOW, LIMIT);
  assert.ok(blocked.ok);
  assert.equal(blocked.value.allowed, false);

  const reset = await touchRateLimit(db, "bucket", 1000 + WINDOW, WINDOW, LIMIT);
  assert.ok(reset.ok);
  assert.deepEqual(reset.value, { count: 1, allowed: true });
});

void test("touchRateLimit keeps buckets independent", async () => {
  const { db } = createTestDatabase();

  for (let i = 0; i < LIMIT; i += 1) await touchRateLimit(db, "first", 1000, WINDOW, LIMIT);

  const other = await touchRateLimit(db, "second", 1000, WINDOW, LIMIT);
  assert.ok(other.ok);
  assert.deepEqual(other.value, { count: 1, allowed: true });
});
