/// <reference types="node" />
import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import { isIdleExpired, startIdleLock } from "./idle-lock.ts";

afterEach(() => {
  mock.timers.reset();
});

void test("isIdleExpired triggers at the timeout, not before", () => {
  assert.equal(isIdleExpired(null, 1000), false);
  assert.equal(isIdleExpired(999, 1000), false);
  assert.equal(isIdleExpired(1000, 1000), true);
  assert.equal(isIdleExpired(5000, 1000), true);
});

const setup = () => {
  mock.timers.enable({ apis: ["setInterval", "Date"], now: 0 });
  let lastActivity: number | null = 0;
  let locks = 0;
  const stop = startIdleLock({
    now: () => Date.now(),
    idleMs: (nowMs) => (lastActivity === null ? null : nowMs - lastActivity),
    lock: () => {
      locks += 1;
      lastActivity = null;
    },
    timeoutMs: 15 * 60 * 1000,
    intervalMs: 10_000,
  });
  return {
    stop,
    touch: () => {
      if (lastActivity !== null) lastActivity = Date.now();
    },
    locks: () => locks,
  };
};

void test("startIdleLock locks once the session has been idle for the timeout", () => {
  const lock = setup();

  mock.timers.tick(15 * 60 * 1000 - 10_000);
  assert.equal(lock.locks(), 0);

  mock.timers.tick(10_000);
  assert.equal(lock.locks(), 1);

  mock.timers.tick(60 * 60 * 1000);
  assert.equal(lock.locks(), 1);
  lock.stop();
});

void test("startIdleLock resets the countdown on activity", () => {
  const lock = setup();

  mock.timers.tick(10 * 60 * 1000);
  lock.touch();
  mock.timers.tick(10 * 60 * 1000);
  assert.equal(lock.locks(), 0);

  mock.timers.tick(5 * 60 * 1000);
  assert.equal(lock.locks(), 1);
  lock.stop();
});

void test("startIdleLock stops checking after stop", () => {
  const lock = setup();
  lock.stop();

  mock.timers.tick(60 * 60 * 1000);
  assert.equal(lock.locks(), 0);
});
