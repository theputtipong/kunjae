/// <reference types="node" />
import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import { createClipboardGuard } from "./clipboard.ts";

afterEach(() => {
  mock.timers.reset();
});

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

const setup = (focused: { value: boolean }) => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const writes: string[] = [];
  const listeners = new Set<() => void>();

  const guard = createClipboardGuard({
    write: (text) => {
      if (!focused.value) return Promise.reject(new Error("Document is not focused"));
      writes.push(text);
      return Promise.resolve();
    },
    onRefocus: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clearAfterMs: 30_000,
  });

  const refocus = (): void => {
    for (const listener of [...listeners]) listener();
  };

  return { guard, writes, listeners, refocus };
};

void test("clears the clipboard after the delay", async () => {
  const focused = { value: true };
  const env = setup(focused);

  assert.equal(await env.guard.copy("secret"), true);
  mock.timers.tick(29_999);
  await flush();
  assert.deepEqual(env.writes, ["secret"]);

  mock.timers.tick(1);
  await flush();
  assert.deepEqual(env.writes, ["secret", ""]);
});

void test("retries the clear when the page regains focus", async () => {
  const focused = { value: true };
  const env = setup(focused);

  await env.guard.copy("secret");
  focused.value = false;
  mock.timers.tick(30_000);
  await flush();
  assert.deepEqual(env.writes, ["secret"]);
  assert.equal(env.listeners.size, 1);

  env.refocus();
  await flush();
  assert.deepEqual(env.writes, ["secret"]);
  assert.equal(env.listeners.size, 1);

  focused.value = true;
  env.refocus();
  await flush();
  assert.deepEqual(env.writes, ["secret", ""]);
  assert.equal(env.listeners.size, 0);
});

void test("a new copy replaces the pending clear", async () => {
  const focused = { value: true };
  const env = setup(focused);

  await env.guard.copy("first");
  focused.value = false;
  mock.timers.tick(30_000);
  await flush();
  assert.equal(env.listeners.size, 1);

  focused.value = true;
  await env.guard.copy("second");
  assert.equal(env.listeners.size, 0);

  mock.timers.tick(30_000);
  await flush();
  assert.deepEqual(env.writes, ["first", "second", ""]);
});

void test("reports failure when the copy itself is refused", async () => {
  const focused = { value: false };
  const env = setup(focused);

  assert.equal(await env.guard.copy("secret"), false);
  mock.timers.tick(60_000);
  await flush();
  assert.equal(env.listeners.size, 0);
});
