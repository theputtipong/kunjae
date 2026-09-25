import { ok, err } from "../result.ts";
import { invalidLength, type CryptoResult } from "../errors.ts";
import type { Brand, Bytes } from "../types.ts";
import { requireLength, wipe } from "../primitives/bytes.ts";
import { utf8ToBytes } from "../primitives/encoding.ts";
import { randomBytes } from "../primitives/random.ts";
import { importAeadKey } from "../primitives/aead.ts";
import {
  openFromEnvelope,
  parseEnvelope,
  sealToEnvelope,
  type Envelope,
} from "../envelope/envelope.ts";
import type { WrappingKey } from "./account-keys.ts";

export type VaultKey = Brand<Bytes, "VaultKey">;

export type WrappedVaultKey = Brand<Envelope, "WrappedVaultKey">;

export const VAULT_KEY_BYTES = 32;

const VAULT_KEY_AAD_PREFIX = "kunjae.v1.vault-key|";

export const generateVaultKey = (): CryptoResult<VaultKey> => {
  const drawn = randomBytes(VAULT_KEY_BYTES);
  if (!drawn.ok) return drawn;
  return ok(drawn.value as VaultKey);
};

export const toVaultKey = (bytes: Bytes): CryptoResult<VaultKey> => {
  const checked = requireLength("vaultKey", VAULT_KEY_BYTES)(bytes);
  if (!checked.ok) return checked;
  return ok(checked.value as VaultKey);
};

export const toWrappedVaultKey = (value: unknown): CryptoResult<WrappedVaultKey> => {
  const envelope = parseEnvelope(value);
  if (!envelope.ok) return envelope;
  return ok(envelope.value as WrappedVaultKey);
};

export const importVaultKey = (vaultKey: VaultKey) => importAeadKey(vaultKey);

export const wipeVaultKey = (vaultKey: VaultKey): void => {
  wipe(vaultKey);
};

const buildVaultKeyAad = (vaultId: string) =>
  utf8ToBytes(`${VAULT_KEY_AAD_PREFIX}${vaultId}`);

export const wrapVaultKey = async (
  wrappingKey: WrappingKey,
  vaultKey: VaultKey,
  vaultId: string,
): Promise<CryptoResult<WrappedVaultKey>> => {
  const aad = buildVaultKeyAad(vaultId);
  if (!aad.ok) return aad;

  const cryptoKey = await importAeadKey(wrappingKey);
  if (!cryptoKey.ok) return cryptoKey;

  const sealed = await sealToEnvelope(cryptoKey.value, vaultKey, aad.value);
  if (!sealed.ok) return sealed;

  return ok(sealed.value as WrappedVaultKey);
};

export const unwrapVaultKey = async (
  wrappingKey: WrappingKey,
  wrapped: WrappedVaultKey,
  vaultId: string,
): Promise<CryptoResult<VaultKey>> => {
  const aad = buildVaultKeyAad(vaultId);
  if (!aad.ok) return aad;

  const cryptoKey = await importAeadKey(wrappingKey);
  if (!cryptoKey.ok) return cryptoKey;

  const opened = await openFromEnvelope(cryptoKey.value, wrapped, aad.value);
  if (!opened.ok) return opened;

  if (opened.value.length !== VAULT_KEY_BYTES) {
    wipe(opened.value);
    return err(invalidLength("vaultKey", VAULT_KEY_BYTES, opened.value.length));
  }

  return ok(opened.value as VaultKey);
};
