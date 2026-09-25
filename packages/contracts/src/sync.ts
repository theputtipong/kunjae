import { z } from "zod";

import { EnvelopeSchema, IsoDateTimeSchema, UlidSchema } from "./common.ts";

export const SYNC_LIMITS = {
  pullPageSize: 200,
  pushBatchSize: 50,
  vaultsPerAccount: 64,
} as const;

export const RevisionSchema = z.int().nonnegative();

export const ItemVersionSchema = z.int().positive();

export const ITEM_AAD_PREFIX = "kunjae.v1.item|";

export const buildItemAad = (itemId: string, version: number): string =>
  `${ITEM_AAD_PREFIX}${itemId}|${String(version)}`;

export const VAULT_META_AAD_PREFIX = "kunjae.v1.vault-meta|";

export const buildVaultMetaAad = (vaultId: string, version: number): string =>
  `${VAULT_META_AAD_PREFIX}${vaultId}|${String(version)}`;

export const VaultRecordSchema = z.strictObject({
  vaultId: UlidSchema,
  version: ItemVersionSchema,
  updatedAt: IsoDateTimeSchema,

  wrappedVaultKey: EnvelopeSchema,

  metadata: EnvelopeSchema,
});

export type VaultRecord = z.infer<typeof VaultRecordSchema>;

const ItemBaseShape = {
  itemId: UlidSchema,
  vaultId: UlidSchema,
  version: ItemVersionSchema,
  updatedAt: IsoDateTimeSchema,
} as const;

export const ItemRecordSchema = z.strictObject({
  ...ItemBaseShape,
  deleted: z.literal(false),
  envelope: EnvelopeSchema,
});

export const ItemTombstoneSchema = z.strictObject({
  ...ItemBaseShape,
  deleted: z.literal(true),
});

export const SyncedItemSchema = z.discriminatedUnion("deleted", [
  ItemRecordSchema,
  ItemTombstoneSchema,
]);

export type SyncedItem = z.infer<typeof SyncedItemSchema>;
export type ItemRecord = z.infer<typeof ItemRecordSchema>;
export type ItemTombstone = z.infer<typeof ItemTombstoneSchema>;

export const SyncPullRequestSchema = z.strictObject({
  since: RevisionSchema,
});

export type SyncPullRequest = z.infer<typeof SyncPullRequestSchema>;

export const SyncPullResponseSchema = z.strictObject({
  vaults: z.array(VaultRecordSchema).max(SYNC_LIMITS.vaultsPerAccount),
  items: z.array(SyncedItemSchema).max(SYNC_LIMITS.pullPageSize),

  revision: RevisionSchema,

  hasMore: z.boolean(),
});

export type SyncPullResponse = z.infer<typeof SyncPullResponseSchema>;

const ItemChangeBaseShape = {
  itemId: UlidSchema,
  vaultId: UlidSchema,
  baseVersion: RevisionSchema,
  version: ItemVersionSchema,
} as const;

export const ItemUpsertSchema = z.strictObject({
  ...ItemChangeBaseShape,
  deleted: z.literal(false),
  envelope: EnvelopeSchema,
});

export const ItemDeleteSchema = z.strictObject({
  ...ItemChangeBaseShape,
  deleted: z.literal(true),
});

export const ItemChangeSchema = z
  .discriminatedUnion("deleted", [ItemUpsertSchema, ItemDeleteSchema])
  .refine((change) => change.version === change.baseVersion + 1, {
    message: "version ต้องเท่ากับ baseVersion + 1 เสมอ",
  });

export type ItemChange = z.infer<typeof ItemChangeSchema>;

export const SyncPushRequestSchema = z.strictObject({
  changes: z.array(ItemChangeSchema).min(1).max(SYNC_LIMITS.pushBatchSize),
});

export type SyncPushRequest = z.infer<typeof SyncPushRequestSchema>;

export const AppliedChangeSchema = z.strictObject({
  itemId: UlidSchema,
  version: ItemVersionSchema,
  updatedAt: IsoDateTimeSchema,
});

export const ConflictedChangeSchema = z.strictObject({
  itemId: UlidSchema,
  serverVersion: ItemVersionSchema,
});

export const SyncPushResponseSchema = z.strictObject({
  applied: z.array(AppliedChangeSchema).max(SYNC_LIMITS.pushBatchSize),
  conflicts: z.array(ConflictedChangeSchema).max(SYNC_LIMITS.pushBatchSize),
  revision: RevisionSchema,
});

export type SyncPushResponse = z.infer<typeof SyncPushResponseSchema>;
