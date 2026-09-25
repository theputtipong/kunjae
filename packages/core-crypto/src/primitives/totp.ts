import { hmac } from "@noble/hashes/hmac.js";
import { sha1 } from "@noble/hashes/legacy.js";
import { sha256, sha512 } from "@noble/hashes/sha2.js";

import { invalidFormat, invalidParameter, type CryptoResult } from "../errors.ts";
import { err, fromThrowable, ok } from "../result.ts";
import type { Bytes } from "../types.ts";

export const TOTP_ALGORITHMS = ["SHA1", "SHA256", "SHA512"] as const;
export type TotpAlgorithm = (typeof TOTP_ALGORITHMS)[number];

export const DEFAULT_TOTP_PERIOD_SECONDS = 30;
export const DEFAULT_TOTP_DIGITS = 6;
export const DEFAULT_TOTP_ALGORITHM: TotpAlgorithm = "SHA1";

const MIN_DIGITS = 6;
const MAX_DIGITS = 8;

const MIN_PERIOD = 15;
const MAX_PERIOD = 300;

export type TotpParams = {
  readonly algorithm: TotpAlgorithm;
  readonly digits: number;
  readonly periodSeconds: number;
};

export const DEFAULT_TOTP_PARAMS: TotpParams = {
  algorithm: DEFAULT_TOTP_ALGORITHM,
  digits: DEFAULT_TOTP_DIGITS,
  periodSeconds: DEFAULT_TOTP_PERIOD_SECONDS,
};

const RFC4648_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const decodeTotpSecret = (text: string): CryptoResult<Bytes> => {
  const cleaned = text.replace(/[\s-]/gu, "").toUpperCase().replace(/=+$/u, "");
  if (cleaned.length === 0) return err(invalidFormat("totp-secret"));

  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const character of cleaned) {
    const index = RFC4648_ALPHABET.indexOf(character);
    if (index < 0) return err(invalidFormat("totp-secret"));

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      out.push((value >> bits) & 0xff);
    }
  }

  if (bits > 0 && (value & ((1 << bits) - 1)) !== 0) {
    return err(invalidFormat("totp-secret"));
  }

  if (out.length === 0) return err(invalidFormat("totp-secret"));

  return ok(Uint8Array.from(out));
};

const HASHES = { SHA1: sha1, SHA256: sha256, SHA512: sha512 } as const;

const DIGIT_MODULUS = [0, 0, 0, 0, 0, 0, 1_000_000, 10_000_000, 100_000_000] as const;

const counterToBytes = (counter: bigint): Uint8Array => {
  const out = new Uint8Array(8);
  let remaining = counter;

  for (let i = 7; i >= 0; i -= 1) {
    out[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }

  return out;
};

export const hotp = (
  secret: Bytes,
  counter: bigint,
  params: TotpParams = DEFAULT_TOTP_PARAMS,
): CryptoResult<string> => {
  if (secret.length === 0) return err(invalidParameter("secret"));
  if (counter < 0n) return err(invalidParameter("counter"));
  if (!Number.isInteger(params.digits) || params.digits < MIN_DIGITS || params.digits > MAX_DIGITS) {
    return err(invalidParameter("digits"));
  }

  const hash = HASHES[params.algorithm];

  return fromThrowable(
    () => {
      const mac = hmac(hash, secret, counterToBytes(counter));

      const offset = (mac[mac.length - 1] ?? 0) & 0x0f;

      const binary =
        (((mac[offset] ?? 0) & 0x7f) << 24) |
        (((mac[offset + 1] ?? 0) & 0xff) << 16) |
        (((mac[offset + 2] ?? 0) & 0xff) << 8) |
        ((mac[offset + 3] ?? 0) & 0xff);

      const modulus = DIGIT_MODULUS[params.digits] ?? 1_000_000;

      return String(binary % modulus).padStart(params.digits, "0");
    },
    () => invalidParameter("secret"),
  );
};

export const totpCounter = (nowMs: number, periodSeconds: number): bigint =>
  BigInt(Math.floor(nowMs / 1000 / periodSeconds));

export type TotpCode = {
  readonly code: string;
  readonly secondsRemaining: number;
};

export const totp = (
  secret: Bytes,
  nowMs: number,
  params: TotpParams = DEFAULT_TOTP_PARAMS,
): CryptoResult<TotpCode> => {
  if (!Number.isFinite(nowMs) || nowMs < 0) return err(invalidParameter("nowMs"));
  if (
    !Number.isInteger(params.periodSeconds) ||
    params.periodSeconds < MIN_PERIOD ||
    params.periodSeconds > MAX_PERIOD
  ) {
    return err(invalidParameter("periodSeconds"));
  }

  const code = hotp(secret, totpCounter(nowMs, params.periodSeconds), params);
  if (!code.ok) return code;

  const seconds = Math.floor(nowMs / 1000);
  const remaining = params.periodSeconds - (seconds % params.periodSeconds);

  return ok({ code: code.value, secondsRemaining: remaining });
};

export const totpFromSecretText = (
  secretText: string,
  nowMs: number,
  params: TotpParams = DEFAULT_TOTP_PARAMS,
): CryptoResult<TotpCode> => {
  const secret = decodeTotpSecret(secretText);
  if (!secret.ok) return secret;

  try {
    return totp(secret.value, nowMs, params);
  } finally {
    secret.value.fill(0);
  }
};
