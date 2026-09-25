import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

import { ok, err, fromThrowable } from "../result.ts";
import { invalidParameter, keyDerivationFailed, type CryptoResult } from "../errors.ts";
import type { Bytes } from "../types.ts";

const HASH_OUTPUT_BYTES = 32;

const MAX_OUTPUT_BYTES = 255 * HASH_OUTPUT_BYTES;

export const DERIVED_KEY_BYTES = 32;

const MIN_SALT_BYTES = 16;

export const KEY_PURPOSE = {
  AUTHENTICATION: "kunjae.v1.authentication",

  VAULT_KEY_WRAPPING: "kunjae.v1.vault-key-wrapping",

  SECRET_KEY_STRETCH: "kunjae.v1.secret-key-stretch",

  MASTER_UNLOCK_KEY: "kunjae.v1.master-unlock-key",
} as const;

export type KeyPurpose = (typeof KEY_PURPOSE)[keyof typeof KEY_PURPOSE];

const PURPOSE_ENCODER = new TextEncoder();

export type DeriveKeyParams = {
  readonly ikm: Bytes;
  readonly salt: Bytes;
  readonly purpose: KeyPurpose;
  readonly length: number;
};

export const deriveKey = (params: DeriveKeyParams): CryptoResult<Bytes> => {
  const { ikm, salt, purpose, length } = params;

  if (ikm.length === 0) return err(invalidParameter("ikm"));
  if (salt.length < MIN_SALT_BYTES) return err(invalidParameter("salt"));
  if (!Number.isInteger(length) || length <= 0 || length > MAX_OUTPUT_BYTES) {
    return err(invalidParameter("length"));
  }

  return fromThrowable(
    () => hkdf(sha256, ikm, salt, PURPOSE_ENCODER.encode(purpose), length),
    () => keyDerivationFailed(),
  );
};

export const deriveKey256 = (
  ikm: Bytes,
  salt: Bytes,
  purpose: KeyPurpose,
): CryptoResult<Bytes> =>
  deriveKey({ ikm, salt, purpose, length: DERIVED_KEY_BYTES });

export const deriveKeys = <const P extends readonly KeyPurpose[]>(
  ikm: Bytes,
  salt: Bytes,
  purposes: P,
): CryptoResult<Readonly<Record<P[number], Bytes>>> => {
  const out: Partial<Record<KeyPurpose, Bytes>> = {};

  for (const purpose of purposes) {
    const derived = deriveKey256(ikm, salt, purpose);
    if (!derived.ok) return derived;
    out[purpose] = derived.value;
  }

  return ok(out as Readonly<Record<P[number], Bytes>>);
};
