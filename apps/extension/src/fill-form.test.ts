/// <reference types="node" />
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { fillCredentials, fillOtpCode } from "./fill-form.ts";

type InputSpec = {
  readonly type?: string;
  readonly autocomplete?: string;
  readonly hidden?: boolean;
  readonly visible?: boolean;
  readonly disabled?: boolean;
};

class FakeInput {
  readonly type: string;
  readonly autocomplete: string;
  readonly hidden: boolean;
  readonly disabled: boolean;
  readonly offsetParent: object | null;
  form: FakeScope | null = null;
  value = "";
  readonly events: string[] = [];

  constructor(spec: InputSpec) {
    this.type = spec.type ?? "text";
    this.autocomplete = spec.autocomplete ?? "";
    this.hidden = spec.hidden ?? false;
    this.disabled = spec.disabled ?? false;
    this.offsetParent = spec.visible === false ? null : {};
  }

  focus(): void {
    this.events.push("focus");
  }

  dispatchEvent(event: Event): boolean {
    this.events.push(event.type);
    return true;
  }
}

class FakeScope {
  readonly inputs: FakeInput[];

  constructor(inputs: FakeInput[]) {
    this.inputs = inputs;
  }

  querySelectorAll(selector: string): FakeInput[] {
    if (selector === "input") return [...this.inputs];
    if (selector === "input[type='password']") return this.inputs.filter((i) => i.type === "password");
    if (selector === "input[autocomplete='one-time-code']") {
      return this.inputs.filter((i) => i.autocomplete === "one-time-code");
    }
    throw new Error(`unsupported selector ${selector}`);
  }
}

const input = (spec: InputSpec = {}): FakeInput => new FakeInput(spec);

const mount = (layout: readonly (FakeInput | readonly FakeInput[])[]): void => {
  const all: FakeInput[] = [];
  for (const entry of layout) {
    if (entry instanceof FakeInput) {
      all.push(entry);
      continue;
    }
    const form = new FakeScope([...entry]);
    for (const field of entry) field.form = form;
    all.push(...entry);
  }
  Object.assign(globalThis, { document: new FakeScope(all) });
};

const saved: Record<string, unknown> = {};

beforeEach(() => {
  saved["document"] = Reflect.get(globalThis, "document");
  saved["HTMLInputElement"] = Reflect.get(globalThis, "HTMLInputElement");
  Object.assign(globalThis, { HTMLInputElement: FakeInput });
});

afterEach(() => {
  Object.assign(globalThis, { document: saved["document"], HTMLInputElement: saved["HTMLInputElement"] });
});

void test("fillCredentials fills username and password inside a form", () => {
  const user = input({ type: "email" });
  const pass = input({ type: "password" });
  mount([input(), [input({ type: "hidden" }), user, pass]]);

  assert.equal(fillCredentials("me@example.com", "s3cret"), true);
  assert.equal(user.value, "me@example.com");
  assert.equal(pass.value, "s3cret");
  assert.deepEqual(pass.events, ["focus", "input", "change"]);
});

void test("fillCredentials fills username when the password field has no form", () => {
  const user = input({ type: "text" });
  const pass = input({ type: "password" });
  mount([input({ type: "search", visible: false }), user, input({ type: "checkbox" }), pass, input()]);

  assert.equal(fillCredentials("me", "s3cret"), true);
  assert.equal(user.value, "me");
  assert.equal(pass.value, "s3cret");
});

void test("fillCredentials skips hidden username candidates", () => {
  const visibleUser = input({ type: "email" });
  const hiddenUser = input({ type: "text", hidden: true });
  const pass = input({ type: "password" });
  mount([visibleUser, hiddenUser, pass]);

  fillCredentials("me", "pw");
  assert.equal(visibleUser.value, "me");
  assert.equal(hiddenUser.value, "");
});

void test("fillCredentials does not take a field after the password as username", () => {
  const pass = input({ type: "password" });
  const after = input({ type: "text" });
  mount([pass, after]);

  assert.equal(fillCredentials("me", "pw"), true);
  assert.equal(after.value, "");
  assert.equal(pass.value, "pw");
});

void test("fillCredentials leaves username alone when the saved one is empty", () => {
  const user = input();
  const pass = input({ type: "password" });
  mount([[user, pass]]);

  fillCredentials("", "pw");
  assert.equal(user.value, "");
  assert.deepEqual(user.events, []);
});

void test("fillCredentials returns false without a visible password field", () => {
  mount([input(), input({ type: "password", visible: false })]);
  assert.equal(fillCredentials("me", "pw"), false);
});

void test("fillOtpCode fills a single field", () => {
  const field = input({ autocomplete: "one-time-code" });
  mount([field]);

  assert.equal(fillOtpCode("123456"), true);
  assert.equal(field.value, "123456");
});

void test("fillOtpCode splits across one field per digit", () => {
  const fields = Array.from({ length: 6 }, () => input({ autocomplete: "one-time-code" }));
  mount(fields);

  assert.equal(fillOtpCode("123456"), true);
  assert.deepEqual(fields.map((f) => f.value), ["1", "2", "3", "4", "5", "6"]);
});

void test("fillOtpCode refuses when field count does not match the code", () => {
  const fields = Array.from({ length: 4 }, () => input({ autocomplete: "one-time-code" }));
  mount(fields);

  assert.equal(fillOtpCode("123456"), false);
  assert.deepEqual(fields.map((f) => f.value), ["", "", "", ""]);
});

void test("fillOtpCode ignores disabled and hidden fields", () => {
  mount([
    input({ autocomplete: "one-time-code", disabled: true }),
    input({ autocomplete: "one-time-code", visible: false }),
  ]);

  assert.equal(fillOtpCode("123456"), false);
});
