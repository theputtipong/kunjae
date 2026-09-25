import { ok, err, fromThrowable } from "../result.ts";
import {
  invalidParameter,
  keyDerivationFailed,
  randomSourceUnavailable,
  type CryptoResult,
} from "../errors.ts";
import type { Bytes } from "../types.ts";

const MAX_BYTES_PER_CALL = 65_536;

const MAX_SAMPLING_ATTEMPTS = 128;

const resolveCrypto = (): Crypto | undefined => {
  const scope = globalThis as { crypto?: Crypto };
  return typeof scope.crypto?.getRandomValues === "function" ? scope.crypto : undefined;
};

export const randomBytes = (length: number): CryptoResult<Bytes> => {
  if (!Number.isInteger(length) || length < 0) return err(invalidParameter("length"));

  const source = resolveCrypto();
  if (source === undefined) return err(randomSourceUnavailable());

  const out = new Uint8Array(length);

  return fromThrowable(
    () => {
      for (let offset = 0; offset < length; offset += MAX_BYTES_PER_CALL) {
        const end = Math.min(offset + MAX_BYTES_PER_CALL, length);
        source.getRandomValues(out.subarray(offset, end));
      }
      return out;
    },
    () => randomSourceUnavailable(),
  );
};

const readUint32 = (bytes: Bytes): number =>
  (((bytes[0] ?? 0) << 24) |
    ((bytes[1] ?? 0) << 16) |
    ((bytes[2] ?? 0) << 8) |
    (bytes[3] ?? 0)) >>>
  0;

const UINT32_RANGE = 0x1_0000_0000;

export const randomInt = (maxExclusive: number): CryptoResult<number> => {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32_RANGE) {
    return err(invalidParameter("maxExclusive"));
  }
  if (maxExclusive === 1) return ok(0);

  const acceptLimit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive;

  for (let attempt = 0; attempt < MAX_SAMPLING_ATTEMPTS; attempt += 1) {
    const drawn = randomBytes(4);
    if (!drawn.ok) return drawn;

    const value = readUint32(drawn.value);
    if (value < acceptLimit) return ok(value % maxExclusive);
  }

  return err(keyDerivationFailed());
};

export const randomIndexes = (
  count: number,
  maxExclusive: number,
): CryptoResult<readonly number[]> => {
  if (!Number.isInteger(count) || count < 0) return err(invalidParameter("count"));

  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const drawn = randomInt(maxExclusive);
    if (!drawn.ok) return drawn;
    out.push(drawn.value);
  }
  return ok(out);
};
