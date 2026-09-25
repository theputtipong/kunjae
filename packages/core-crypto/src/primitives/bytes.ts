import { ok, err, type Result } from "../result.ts";
import { invalidLength, type InvalidLength, type Literal } from "../errors.ts";
import type { Bytes } from "../types.ts";

export const constantTimeEqual = (a: Bytes, b: Bytes): boolean => {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }

  return diff === 0;
};

export const wipe = (bytes: Bytes): void => {
  bytes.fill(0);
};

export const withWiped = <T>(secret: Bytes, use: (secret: Bytes) => T): T => {
  try {
    return use(secret);
  } finally {
    wipe(secret);
  }
};

export const concatBytes = (...parts: readonly Bytes[]): Bytes => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);

  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

export const cloneBytes = (bytes: Bytes): Bytes => Uint8Array.from(bytes);

export const requireLength =
  <F extends string>(field: Literal<F>, expected: number) =>
  (bytes: Bytes): Result<Bytes, InvalidLength> =>
    bytes.length === expected
      ? ok(bytes)
      : err(invalidLength(field, expected, bytes.length));

const isSharedBuffer = (buffer: ArrayBufferLike): boolean =>
  Object.prototype.toString.call(buffer) === "[object SharedArrayBuffer]";

export const isBytes = (value: unknown): value is Bytes => {
  const looksLikeUint8Array =
    value instanceof Uint8Array ||
    (typeof value === "object" &&
      value !== null &&
      Object.prototype.toString.call(value) === "[object Uint8Array]");

  return looksLikeUint8Array && !isSharedBuffer((value as Uint8Array).buffer);
};
