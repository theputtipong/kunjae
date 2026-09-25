import {
  ok,
  utf8ToBytes,
  openFromEnvelope,
  sealToEnvelope,
} from "@kunjae/core-crypto";
import { buildItemAad, type ItemChange, type ItemRecord } from "@kunjae/contracts";

import {
  decodeItemContent,
  encodeItemContent,
  type DomainResult,
  type ItemContent,
} from "./item-content.ts";

export type DecryptedItem = {
  readonly itemId: string;
  readonly vaultId: string;
  readonly version: number;
  readonly content: ItemContent;
};

export type ItemRef = {
  readonly itemId: string;
  readonly vaultId: string;
  readonly version: number;
};

const FIRST_VERSION = 1;

const NO_BASE_VERSION = 0;

const itemAadBytes = (itemId: string, version: number) =>
  utf8ToBytes(buildItemAad(itemId, version));

const withUpdatedAt = (content: ItemContent, now: string): ItemContent => ({
  ...content,
  updatedAt: now,
});

const sealContent = async (
  vaultKey: CryptoKey,
  itemId: string,
  version: number,
  content: ItemContent,
) => {
  const bytes = encodeItemContent(content);
  if (!bytes.ok) return bytes;

  const aad = itemAadBytes(itemId, version);
  if (!aad.ok) return aad;

  return sealToEnvelope(vaultKey, bytes.value, aad.value);
};

export type CreateItemParams = {
  readonly itemId: string;
  readonly vaultId: string;
  readonly content: ItemContent;
  readonly now: string;
};

export const createItem = async (
  vaultKey: CryptoKey,
  params: CreateItemParams,
): Promise<DomainResult<ItemChange>> => {
  const content = withUpdatedAt(params.content, params.now);

  const sealed = await sealContent(vaultKey, params.itemId, FIRST_VERSION, content);
  if (!sealed.ok) return sealed;

  return ok({
    itemId: params.itemId,
    vaultId: params.vaultId,
    baseVersion: NO_BASE_VERSION,
    version: FIRST_VERSION,
    deleted: false,
    envelope: sealed.value,
  });
};

export const updateItem = async (
  vaultKey: CryptoKey,
  ref: ItemRef,
  content: ItemContent,
  now: string,
): Promise<DomainResult<ItemChange>> => {
  const nextVersion = ref.version + 1;
  const updated = withUpdatedAt(content, now);

  const sealed = await sealContent(vaultKey, ref.itemId, nextVersion, updated);
  if (!sealed.ok) return sealed;

  return ok({
    itemId: ref.itemId,
    vaultId: ref.vaultId,
    baseVersion: ref.version,
    version: nextVersion,
    deleted: false,
    envelope: sealed.value,
  });
};

export const deleteItem = (ref: ItemRef): ItemChange => ({
  itemId: ref.itemId,
  vaultId: ref.vaultId,
  baseVersion: ref.version,
  version: ref.version + 1,
  deleted: true,
});

export const openItem = async (
  vaultKey: CryptoKey,
  record: ItemRecord,
): Promise<DomainResult<DecryptedItem>> => {
  const aad = itemAadBytes(record.itemId, record.version);
  if (!aad.ok) return aad;

  const plaintext = await openFromEnvelope(vaultKey, record.envelope, aad.value);
  if (!plaintext.ok) return plaintext;

  const content = decodeItemContent(plaintext.value);
  if (!content.ok) return content;

  return ok({
    itemId: record.itemId,
    vaultId: record.vaultId,
    version: record.version,
    content: content.value,
  });
};

export const openItems = async (
  vaultKey: CryptoKey,
  records: readonly ItemRecord[],
): Promise<readonly DomainResult<DecryptedItem>[]> =>
  Promise.all(records.map((record) => openItem(vaultKey, record)));
