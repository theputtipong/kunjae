import { ok, err, fromPromise } from "../result.ts";
import {
  decryptionFailed,
  encryptionFailed,
  invalidLength,
  keyDerivationFailed,
  subtleCryptoUnavailable,
  type CryptoResult,
} from "../errors.ts";
import { randomBytes } from "./random.ts";
import type { Bytes } from "../types.ts";

export const AEAD_KEY_BYTES = 32;

export const AEAD_NONCE_BYTES = 12;

export const AEAD_TAG_BYTES = 16;

const AEAD_TAG_BITS = AEAD_TAG_BYTES * 8;

export const AEAD_MAX_MESSAGES_PER_KEY = 2 ** 32;

export const EMPTY_AAD: Bytes = new Uint8Array(0);

export type AeadSealed = {
  readonly nonce: Bytes;
  readonly ciphertext: Bytes;
};

const resolveSubtle = (): SubtleCrypto | undefined => {
  const scope = globalThis as { crypto?: { subtle?: SubtleCrypto } };
  const subtle = scope.crypto?.subtle;
  return typeof subtle?.encrypt === "function" ? subtle : undefined;
};

export const importAeadKey = async (raw: Bytes): Promise<CryptoResult<CryptoKey>> => {
  if (raw.length !== AEAD_KEY_BYTES) {
    return err(invalidLength("key", AEAD_KEY_BYTES, raw.length));
  }

  const subtle = resolveSubtle();
  if (subtle === undefined) return err(subtleCryptoUnavailable());

  return fromPromise(
    subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]),
    () => keyDerivationFailed(),
  );
};

export const seal = async (
  key: CryptoKey,
  plaintext: Bytes,
  aad: Bytes,
): Promise<CryptoResult<AeadSealed>> => {
  const subtle = resolveSubtle();
  if (subtle === undefined) return err(subtleCryptoUnavailable());

  const drawn = randomBytes(AEAD_NONCE_BYTES);
  if (!drawn.ok) return drawn;
  const nonce = drawn.value;

  const encrypted = await fromPromise(
    subtle.encrypt(
      { name: "AES-GCM", iv: nonce, additionalData: aad, tagLength: AEAD_TAG_BITS },
      key,
      plaintext,
    ),
    () => encryptionFailed(),
  );
  if (!encrypted.ok) return encrypted;

  return ok({ nonce, ciphertext: new Uint8Array(encrypted.value) });
};

export const open = async (
  key: CryptoKey,
  sealed: AeadSealed,
  aad: Bytes,
): Promise<CryptoResult<Bytes>> => {
  if (sealed.nonce.length !== AEAD_NONCE_BYTES) {
    return err(invalidLength("nonce", AEAD_NONCE_BYTES, sealed.nonce.length));
  }
  if (sealed.ciphertext.length < AEAD_TAG_BYTES) {
    return err(invalidLength("ciphertext", AEAD_TAG_BYTES, sealed.ciphertext.length));
  }

  const subtle = resolveSubtle();
  if (subtle === undefined) return err(subtleCryptoUnavailable());

  const decrypted = await fromPromise(
    subtle.decrypt(
      { name: "AES-GCM", iv: sealed.nonce, additionalData: aad, tagLength: AEAD_TAG_BITS },
      key,
      sealed.ciphertext,
    ),
    () => decryptionFailed(),
  );
  if (!decrypted.ok) return decrypted;

  return ok(new Uint8Array(decrypted.value));
};
