import { bytesToBase32, randomBytes, type CryptoResult, err, ok, invalidParameter } from "@kunjae/core-crypto";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const TIME_CHARS = 10;
const RANDOM_BYTES = 10;

const encodeTime = (timeMs: number): CryptoResult<string> => {
  if (!Number.isInteger(timeMs) || timeMs < 0) return err(invalidParameter("timeMs"));

  let remaining = BigInt(timeMs);
  let out = "";

  for (let i = 0; i < TIME_CHARS; i += 1) {
    const index = Number(remaining % 32n);
    out = `${ALPHABET[index] ?? "0"}${out}`;
    remaining /= 32n;
  }

  if (remaining !== 0n) return err(invalidParameter("timeMs"));

  return ok(out);
};

export const createUlid = (nowMs: number): CryptoResult<string> => {
  const time = encodeTime(nowMs);
  if (!time.ok) return time;

  const bytes = randomBytes(RANDOM_BYTES);
  if (!bytes.ok) return bytes;

  return ok(`${time.value}${bytesToBase32(bytes.value)}`);
};
