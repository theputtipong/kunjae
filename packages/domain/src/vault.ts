import {
  err,
  fromThrowable,
  generateVaultKey,
  importVaultKey,
  invalidFormat,
  ok,
  openFromEnvelope,
  sealToEnvelope,
  toWrappedVaultKey,
  unwrapVaultKey,
  utf8ToBytes,
  bytesToUtf8,
  wipeVaultKey,
  wrapVaultKey,
  type Bytes,
  type Envelope,
  type WrappingKey,
} from "@kunjae/core-crypto";
import { buildVaultMetaAad, type VaultRecord } from "@kunjae/contracts";
import { z } from "zod";

import type { DomainResult } from "./item-content.ts";

export const VAULT_FIELD_LIMITS = {
  name: 100,
  icon: 40,
} as const;

export const VaultMetadataSchema = z.strictObject({
  name: z.string().min(1).max(VAULT_FIELD_LIMITS.name),
  icon: z.string().max(VAULT_FIELD_LIMITS.icon),
  color: z.string().toLowerCase().regex(/^#[0-9a-f]{6}$/u).or(z.literal("")),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export type VaultMetadata = z.infer<typeof VaultMetadataSchema>;

export type NewVaultPayload = {
  readonly vaultId: string;
  readonly wrappedVaultKey: Envelope;
  readonly metadata: Envelope;
};

export type CreatedVault = {
  readonly payload: NewVaultPayload;
  readonly key: CryptoKey;
};

export type OpenedVault = {
  readonly vaultId: string;
  readonly version: number;
  readonly metadata: VaultMetadata;
  readonly key: CryptoKey;
};

export type VaultRef = {
  readonly vaultId: string;
  readonly version: number;
};

const FIRST_VERSION = 1;

const metaAadBytes = (vaultId: string, version: number) =>
  utf8ToBytes(buildVaultMetaAad(vaultId, version));

const encodeMetadata = (metadata: VaultMetadata): DomainResult<Bytes> => {
  const json = fromThrowable(
    () => JSON.stringify(metadata),
    () => invalidFormat("vault-metadata"),
  );
  if (!json.ok) return json;
  return utf8ToBytes(json.value);
};

const decodeMetadata = (bytes: Bytes): DomainResult<VaultMetadata> => {
  const text = bytesToUtf8(bytes);
  if (!text.ok) return text;

  const parsed = fromThrowable(
    () => JSON.parse(text.value) as unknown,
    () => invalidFormat("vault-metadata"),
  );
  if (!parsed.ok) return parsed;

  const validated = VaultMetadataSchema.safeParse(parsed.value);
  if (!validated.success) return err(invalidFormat("vault-metadata"));

  return ok(validated.data);
};

const sealMetadata = async (
  vaultCryptoKey: CryptoKey,
  vaultId: string,
  version: number,
  metadata: VaultMetadata,
) => {
  const bytes = encodeMetadata(metadata);
  if (!bytes.ok) return bytes;

  const aad = metaAadBytes(vaultId, version);
  if (!aad.ok) return aad;

  return sealToEnvelope(vaultCryptoKey, bytes.value, aad.value);
};

export type CreateVaultParams = {
  readonly vaultId: string;
  readonly name: string;
  readonly icon: string;
  readonly color: string;
  readonly now: string;
};

export const createVault = async (
  wrappingKey: WrappingKey,
  params: CreateVaultParams,
): Promise<DomainResult<CreatedVault>> => {
  const metadata: VaultMetadata = {
    name: params.name,
    icon: params.icon,
    color: params.color,
    createdAt: params.now,
    updatedAt: params.now,
  };

  const validated = VaultMetadataSchema.safeParse(metadata);
  if (!validated.success) return err(invalidFormat("vault-metadata"));

  const rawKey = generateVaultKey();
  if (!rawKey.ok) return rawKey;

  try {
    const wrapped = await wrapVaultKey(wrappingKey, rawKey.value, params.vaultId);
    if (!wrapped.ok) return wrapped;

    const cryptoKey = await importVaultKey(rawKey.value);
    if (!cryptoKey.ok) return cryptoKey;

    const sealedMeta = await sealMetadata(
      cryptoKey.value,
      params.vaultId,
      FIRST_VERSION,
      validated.data,
    );
    if (!sealedMeta.ok) return sealedMeta;

    return ok({
      payload: {
        vaultId: params.vaultId,
        wrappedVaultKey: wrapped.value,
        metadata: sealedMeta.value,
      },
      key: cryptoKey.value,
    });
  } finally {
    wipeVaultKey(rawKey.value);
  }
};

export const openVault = async (
  wrappingKey: WrappingKey,
  record: VaultRecord,
): Promise<DomainResult<OpenedVault>> => {
  const wrapped = toWrappedVaultKey(record.wrappedVaultKey);
  if (!wrapped.ok) return wrapped;

  const rawKey = await unwrapVaultKey(wrappingKey, wrapped.value, record.vaultId);
  if (!rawKey.ok) return rawKey;

  try {
    const cryptoKey = await importVaultKey(rawKey.value);
    if (!cryptoKey.ok) return cryptoKey;

    const aad = metaAadBytes(record.vaultId, record.version);
    if (!aad.ok) return aad;

    const plaintext = await openFromEnvelope(cryptoKey.value, record.metadata, aad.value);
    if (!plaintext.ok) return plaintext;

    const metadata = decodeMetadata(plaintext.value);
    if (!metadata.ok) return metadata;

    return ok({
      vaultId: record.vaultId,
      version: record.version,
      metadata: metadata.value,
      key: cryptoKey.value,
    });
  } finally {
    wipeVaultKey(rawKey.value);
  }
};

export const updateVaultMetadata = async (
  vaultKey: CryptoKey,
  ref: VaultRef,
  changes: Pick<VaultMetadata, "name" | "icon" | "color">,
  current: VaultMetadata,
  now: string,
): Promise<DomainResult<{ readonly version: number; readonly metadata: Envelope }>> => {
  const next: VaultMetadata = {
    ...current,
    ...changes,
    updatedAt: now,
  };

  const validated = VaultMetadataSchema.safeParse(next);
  if (!validated.success) return err(invalidFormat("vault-metadata"));

  const nextVersion = ref.version + 1;
  const sealed = await sealMetadata(vaultKey, ref.vaultId, nextVersion, validated.data);
  if (!sealed.ok) return sealed;

  return ok({ version: nextVersion, metadata: sealed.value });
};
