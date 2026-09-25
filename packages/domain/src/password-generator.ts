import { err, ok, invalidParameter, randomInt } from "@kunjae/core-crypto";

import type { DomainResult } from "./item-content.ts";

export const CHARSETS = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{}<>:;,.?/~",
} as const;

const AMBIGUOUS: ReadonlySet<string> = new Set(["I", "l", "1", "O", "0", "o"]);

export type CharsetName = keyof typeof CHARSETS;

export const PASSWORD_LENGTH = {
  min: 8,
  max: 128,
  default: 20,
} as const;

export type PasswordOptions = {
  readonly length: number;
  readonly lowercase: boolean;
  readonly uppercase: boolean;
  readonly digits: boolean;
  readonly symbols: boolean;
  readonly excludeAmbiguous: boolean;
  readonly requireEachSet: boolean;
};

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: PASSWORD_LENGTH.default,
  lowercase: true,
  uppercase: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
  requireEachSet: true,
};

const filterAmbiguous = (charset: string, exclude: boolean): string => {
  if (!exclude) return charset;

  let out = "";
  for (let i = 0; i < charset.length; i += 1) {
    const ch = charset.charAt(i);
    if (!AMBIGUOUS.has(ch)) out += ch;
  }
  return out;
};

const selectedCharsets = (options: PasswordOptions): readonly string[] => {
  const picked: string[] = [];
  const add = (name: CharsetName, enabled: boolean) => {
    if (!enabled) return;
    const set = filterAmbiguous(CHARSETS[name], options.excludeAmbiguous);
    if (set.length > 0) picked.push(set);
  };

  add("lowercase", options.lowercase);
  add("uppercase", options.uppercase);
  add("digits", options.digits);
  add("symbols", options.symbols);

  return picked;
};

const pickChar = (charset: string): DomainResult<string> => {
  const index = randomInt(charset.length);
  if (!index.ok) return index;
  return ok(charset.charAt(index.value));
};

const shuffle = (chars: readonly string[]): DomainResult<readonly string[]> => {
  const out = [...chars];

  for (let i = out.length - 1; i > 0; i -= 1) {
    const drawn = randomInt(i + 1);
    if (!drawn.ok) return drawn;

    const j = drawn.value;
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) return err(invalidParameter("length"));
    out[i] = b;
    out[j] = a;
  }

  return ok(out);
};

const validateOptions = (options: PasswordOptions): DomainResult<readonly string[]> => {
  if (
    !Number.isInteger(options.length) ||
    options.length < PASSWORD_LENGTH.min ||
    options.length > PASSWORD_LENGTH.max
  ) {
    return err(invalidParameter("length"));
  }

  const sets = selectedCharsets(options);
  if (sets.length === 0) return err(invalidParameter("charsets"));

  if (options.requireEachSet && options.length < sets.length) {
    return err(invalidParameter("length"));
  }

  return ok(sets);
};

export const generatePassword = (options: PasswordOptions): DomainResult<string> => {
  const validated = validateOptions(options);
  if (!validated.ok) return validated;

  const sets = validated.value;
  const combined = sets.join("");
  const chars: string[] = [];

  if (options.requireEachSet) {
    for (const set of sets) {
      const picked = pickChar(set);
      if (!picked.ok) return picked;
      chars.push(picked.value);
    }
  }

  while (chars.length < options.length) {
    const picked = pickChar(combined);
    if (!picked.ok) return picked;
    chars.push(picked.value);
  }

  const shuffled = shuffle(chars);
  if (!shuffled.ok) return shuffled;

  return ok(shuffled.value.join(""));
};

export const estimateEntropyBits = (options: PasswordOptions): number => {
  const sets = selectedCharsets(options);
  if (sets.length === 0) return 0;
  if (!Number.isInteger(options.length) || options.length <= 0) return 0;

  const total = sets.reduce((sum, set) => sum + set.length, 0);
  const length = options.length;

  if (!options.requireEachSet) {
    return length * Math.log2(total);
  }

  let count = 0;
  const subsets = 1 << sets.length;

  for (let mask = 0; mask < subsets; mask += 1) {
    let excluded = 0;
    let bits = 0;

    for (let i = 0; i < sets.length; i += 1) {
      if ((mask & (1 << i)) !== 0) {
        excluded += sets[i]?.length ?? 0;
        bits += 1;
      }
    }

    const sign = bits % 2 === 0 ? 1 : -1;
    count += sign * Math.pow(total - excluded, length);
  }

  return count > 0 ? Math.log2(count) : 0;
};
