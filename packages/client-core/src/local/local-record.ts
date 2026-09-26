import { z } from "zod";
import {
  AccountSaltSchema,
  Argon2ParamsSchema,
  EnvelopeSchema,
  IsoDateTimeSchema,
  ItemVersionSchema,
  SYNC_LIMITS,
  UlidSchema,
} from "@kunjae/contracts";

export const LOCAL_RECORD_FORMAT = "kunjae.local.v1";

export const LOCAL_LIMITS = {
  vaults: SYNC_LIMITS.vaultsPerAccount,
  items: 20_000,
} as const;

export const LocalVaultEntrySchema = z.strictObject({
  vaultId: UlidSchema,
  version: ItemVersionSchema,
  wrappedVaultKey: EnvelopeSchema,
  encryptedMetadata: EnvelopeSchema,
});

export const LocalItemEntrySchema = z.strictObject({
  itemId: UlidSchema,
  vaultId: UlidSchema,
  version: ItemVersionSchema,
  envelope: EnvelopeSchema,
});

export const LocalRecordSchema = z
  .strictObject({
    format: z.literal(LOCAL_RECORD_FORMAT),
    salt: AccountSaltSchema,
    argon2: Argon2ParamsSchema,
    createdAt: IsoDateTimeSchema,
    vaults: z.array(LocalVaultEntrySchema).min(1).max(LOCAL_LIMITS.vaults),
    items: z.array(LocalItemEntrySchema).max(LOCAL_LIMITS.items),
  })
  .superRefine((record, context) => {
    const vaultIds = new Set(record.vaults.map((vault) => vault.vaultId));
    if (vaultIds.size !== record.vaults.length) {
      context.addIssue({ code: "custom", message: "duplicate vaultId", path: ["vaults"] });
    }

    const itemIds = new Set(record.items.map((item) => item.itemId));
    if (itemIds.size !== record.items.length) {
      context.addIssue({ code: "custom", message: "duplicate itemId", path: ["items"] });
    }

    if (record.items.some((item) => !vaultIds.has(item.vaultId))) {
      context.addIssue({ code: "custom", message: "item references unknown vault", path: ["items"] });
    }
  });

export type LocalVaultEntry = z.infer<typeof LocalVaultEntrySchema>;
export type LocalItemEntry = z.infer<typeof LocalItemEntrySchema>;
export type LocalRecord = z.infer<typeof LocalRecordSchema>;
