import { ok, err } from "../result.ts";
import {
  invalidFormat,
  invalidLength,
  type CryptoResult,
  type EncodingName,
  type InvalidFormat,
  type InvalidLength,
} from "../errors.ts";
import type { Brand, Bytes } from "../types.ts";
import { base32ToBytes, bytesToBase32 } from "../primitives/encoding.ts";
import { randomBytes } from "../primitives/random.ts";
import { requireLength } from "../primitives/bytes.ts";
import type { Result } from "../result.ts";

export type SecretKey = Brand<Bytes, "SecretKey">;

export const SECRET_KEY_BYTES = 16;

export const SECRET_KEY_VERSION = "K1";

export const SECRET_KEY_CHARS = 26;

const GROUP_SIZES: readonly number[] = [6, 5, 5, 5, 5];

const SEPARATORS = /[\s-]+/g;

export const generateSecretKey = (): CryptoResult<SecretKey> => {
  const drawn = randomBytes(SECRET_KEY_BYTES);
  if (!drawn.ok) return drawn;
  return ok(drawn.value as SecretKey);
};

export const toSecretKey = (bytes: Bytes): Result<SecretKey, InvalidLength> => {
  const checked = requireLength("secretKey", SECRET_KEY_BYTES)(bytes);
  if (!checked.ok) return checked;
  return ok(checked.value as SecretKey);
};

export const formatSecretKey = (key: SecretKey): string => {
  const encoded = bytesToBase32(key);

  const groups: string[] = [];
  let offset = 0;
  for (const size of GROUP_SIZES) {
    groups.push(encoded.slice(offset, offset + size));
    offset += size;
  }

  return [SECRET_KEY_VERSION, ...groups].join("-");
};

type ParseError =
  | InvalidFormat
  | InvalidLength
  | { readonly kind: "InvalidEncoding"; readonly encoding: EncodingName };

export const parseSecretKey = (input: string): Result<SecretKey, ParseError> => {
  const normalized = input.replace(SEPARATORS, "").toUpperCase();

  if (!normalized.startsWith(SECRET_KEY_VERSION)) {
    return err(invalidFormat("secret-key-version"));
  }

  const payload = normalized.slice(SECRET_KEY_VERSION.length);
  if (payload.length !== SECRET_KEY_CHARS) {
    return err(invalidLength("secretKeyText", SECRET_KEY_CHARS, payload.length));
  }

  const decoded = base32ToBytes(payload);
  if (!decoded.ok) return decoded;

  return toSecretKey(decoded.value);
};
