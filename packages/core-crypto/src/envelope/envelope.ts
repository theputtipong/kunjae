import { ok, err, fromThrowable } from "../result.ts";
import {
  invalidFormat,
  unsupportedAlgorithm,
  type CryptoResult,
} from "../errors.ts";
import type { Bytes } from "../types.ts";
import { concatBytes } from "../primitives/bytes.ts";
import { base64UrlToBytes, bytesToBase64Url } from "../primitives/encoding.ts";
import { open, seal, type AeadSealed } from "../primitives/aead.ts";

export const ENVELOPE_VERSION = 1;

export type EnvelopeVersion = typeof ENVELOPE_VERSION;

export const ENVELOPE_ALG_AES_256_GCM = "A256GCM";

export type EnvelopeAlgorithm = typeof ENVELOPE_ALG_AES_256_GCM;

export type Envelope = {
  readonly v: EnvelopeVersion;
  readonly alg: EnvelopeAlgorithm;
  readonly n: string;
  readonly ct: string;
};

const HEADER_ENCODER = new TextEncoder();

const buildHeaderAad = (version: EnvelopeVersion, algorithm: EnvelopeAlgorithm): Bytes =>
  new Uint8Array(HEADER_ENCODER.encode(`kunjae.env.${String(version)}.${algorithm}|`));

const bindAad = (
  version: EnvelopeVersion,
  algorithm: EnvelopeAlgorithm,
  callerAad: Bytes,
): Bytes => concatBytes(buildHeaderAad(version, algorithm), callerAad);

export const sealToEnvelope = async (
  key: CryptoKey,
  plaintext: Bytes,
  aad: Bytes,
): Promise<CryptoResult<Envelope>> => {
  const bound = bindAad(ENVELOPE_VERSION, ENVELOPE_ALG_AES_256_GCM, aad);

  const sealed = await seal(key, plaintext, bound);
  if (!sealed.ok) return sealed;

  return ok({
    v: ENVELOPE_VERSION,
    alg: ENVELOPE_ALG_AES_256_GCM,
    n: bytesToBase64Url(sealed.value.nonce),
    ct: bytesToBase64Url(sealed.value.ciphertext),
  });
};

export const openFromEnvelope = async (
  key: CryptoKey,
  envelope: Envelope,
  aad: Bytes,
): Promise<CryptoResult<Bytes>> => {
  /* eslint-disable @typescript-eslint/no-unnecessary-condition */
  if (envelope.v !== ENVELOPE_VERSION) return err(invalidFormat("envelope-version"));
  if (envelope.alg !== ENVELOPE_ALG_AES_256_GCM) {
    return err(unsupportedAlgorithm("envelope-algorithm"));
  }
  /* eslint-enable @typescript-eslint/no-unnecessary-condition */

  const nonce = base64UrlToBytes(envelope.n);
  if (!nonce.ok) return nonce;

  const ciphertext = base64UrlToBytes(envelope.ct);
  if (!ciphertext.ok) return ciphertext;

  const sealed: AeadSealed = { nonce: nonce.value, ciphertext: ciphertext.value };
  const bound = bindAad(envelope.v, envelope.alg, aad);

  return open(key, sealed, bound);
};

export const parseEnvelope = (value: unknown): CryptoResult<Envelope> => {
  if (typeof value !== "object" || value === null) return err(invalidFormat("envelope"));

  const candidate = value as Record<string, unknown>;

  if (candidate["v"] !== ENVELOPE_VERSION) return err(invalidFormat("envelope-version"));
  if (candidate["alg"] !== ENVELOPE_ALG_AES_256_GCM) {
    return err(unsupportedAlgorithm("envelope-algorithm"));
  }

  const nonce = candidate["n"];
  const ciphertext = candidate["ct"];
  if (typeof nonce !== "string" || typeof ciphertext !== "string") {
    return err(invalidFormat("envelope"));
  }

  return ok({
    v: ENVELOPE_VERSION,
    alg: ENVELOPE_ALG_AES_256_GCM,
    n: nonce,
    ct: ciphertext,
  });
};

export const encodeEnvelope = (envelope: Envelope): string => JSON.stringify(envelope);

export const decodeEnvelope = (text: string): CryptoResult<Envelope> => {
  const parsed = fromThrowable(
    () => JSON.parse(text) as unknown,
    () => invalidFormat("envelope"),
  );
  if (!parsed.ok) return parsed;
  return parseEnvelope(parsed.value);
};
