import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable(
  "accounts",
  {
    accountId: text("account_id").primaryKey(),

    email: text("email").notNull().unique(),

    accountSalt: text("account_salt").notNull(),

    argon2MemoryKib: integer("argon2_memory_kib").notNull(),
    argon2Iterations: integer("argon2_iterations").notNull(),
    argon2Parallelism: integer("argon2_parallelism").notNull(),
    argon2HashLength: integer("argon2_hash_length").notNull(),

    authKeyHash: text("auth_key_hash").notNull(),

    tokenEpoch: integer("token_epoch").notNull().default(0),

    revision: integer("revision").notNull().default(0),

    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    check(
      "accounts_argon2_positive",
      sql`${table.argon2MemoryKib} > 0 AND ${table.argon2Iterations} > 0
          AND ${table.argon2Parallelism} > 0 AND ${table.argon2HashLength} > 0`,
    ),
  ],
);

export const vaults = sqliteTable(
  "vaults",
  {
    vaultId: text("vault_id").primaryKey(),

    accountId: text("account_id")
      .notNull()
      .references(() => accounts.accountId, { onDelete: "cascade" }),

    version: integer("version").notNull().default(1),

    wrappedVaultKey: text("wrapped_vault_key").notNull(),

    metadata: text("metadata").notNull(),

    revision: integer("revision").notNull(),

    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("vaults_account_revision_idx").on(table.accountId, table.revision),
  ],
);

export const items = sqliteTable(
  "items",
  {
    itemId: text("item_id").primaryKey(),

    accountId: text("account_id")
      .notNull()
      .references(() => accounts.accountId, { onDelete: "cascade" }),

    vaultId: text("vault_id")
      .notNull()
      .references(() => vaults.vaultId, { onDelete: "cascade" }),

    version: integer("version").notNull(),

    deleted: integer("deleted", { mode: "boolean" }).notNull().default(false),

    envelope: text("envelope"),

    revision: integer("revision").notNull(),

    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("items_account_revision_idx").on(table.accountId, table.revision),

    index("items_vault_idx").on(table.vaultId),

    check(
      "items_tombstone_has_no_content",
      sql`(${table.deleted} = 0 AND ${table.envelope} IS NOT NULL)
          OR (${table.deleted} = 1 AND ${table.envelope} IS NULL)`,
    ),

    check("items_version_positive", sql`${table.version} > 0`),
  ],
);

export const rateLimits = sqliteTable("rate_limits", {
  bucket: text("bucket").primaryKey(),

  windowStart: integer("window_start").notNull(),

  count: integer("count").notNull(),
});

export const accountDailyUsage = sqliteTable(
  "account_daily_usage",
  {
    accountId: text("account_id").notNull(),
    day: text("day").notNull(),
    pulls: integer("pulls").notNull(),
    changes: integer("changes").notNull(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.day] })],
);

export const usageSnapshots = sqliteTable("usage_snapshots", {
  takenOn: text("taken_on").primaryKey(),
  takenAt: text("taken_at").notNull(),
  accounts: integer("accounts").notNull(),
  vaults: integer("vaults").notNull(),
  items: integer("items").notNull(),
  totalRevisions: integer("total_revisions").notNull(),
  estimatedBytes: integer("estimated_bytes").notNull(),
});
