import { and, eq, gt, sql } from "drizzle-orm";
import { ok } from "@kunjae/core-crypto";

import { runQuery, type Db } from "./client.ts";
import type { DbResult } from "./errors.ts";
import { accounts, vaults } from "./schema.ts";

export type VaultRow = {
  readonly vaultId: string;
  readonly version: number;
  readonly wrappedVaultKey: string;
  readonly metadata: string;
  readonly revision: number;
  readonly updatedAt: string;
};

const VAULT_COLUMNS = {
  vaultId: vaults.vaultId,
  version: vaults.version,
  wrappedVaultKey: vaults.wrappedVaultKey,
  metadata: vaults.metadata,
  revision: vaults.revision,
  updatedAt: vaults.updatedAt,
} as const;

export const listVaults = async (db: Db, accountId: string): Promise<DbResult<VaultRow[]>> =>
  runQuery(
    db.select(VAULT_COLUMNS).from(vaults).where(eq(vaults.accountId, accountId)).all(),
  );

export const listVaultsSince = async (
  db: Db,
  accountId: string,
  since: number,
): Promise<DbResult<VaultRow[]>> =>
  runQuery(
    db
      .select(VAULT_COLUMNS)
      .from(vaults)
      .where(and(eq(vaults.accountId, accountId), gt(vaults.revision, since)))
      .orderBy(vaults.revision)
      .all(),
  );

export const filterOwnedVaultIds = async (
  db: Db,
  accountId: string,
  vaultIds: readonly string[],
): Promise<DbResult<string[]>> => {
  if (vaultIds.length === 0) return ok([]);

  const rows = await runQuery(
    db
      .select({ vaultId: vaults.vaultId })
      .from(vaults)
      .where(and(eq(vaults.accountId, accountId), sql`${vaults.vaultId} IN ${vaultIds}`))
      .all(),
  );

  if (!rows.ok) return rows;
  return ok(rows.value.map((row) => row.vaultId));
};

export const countVaults = async (db: Db, accountId: string): Promise<DbResult<number>> => {
  const rows = await runQuery(
    db.select({ count: sql<number>`COUNT(*)` }).from(vaults).where(eq(vaults.accountId, accountId)),
  );
  if (!rows.ok) return rows;

  return ok(rows.value[0]?.count ?? 0);
};

export const insertVault = async (
  db: Db,
  params: {
    readonly accountId: string;
    readonly vaultId: string;
    readonly wrappedVaultKey: string;
    readonly metadata: string;
    readonly now: string;
  },
): Promise<DbResult<void>> => {
  const bumped = sql`(SELECT ${accounts.revision} + 1 FROM ${accounts} WHERE ${accounts.accountId} = ${params.accountId})`;

  const result = await runQuery(
    db.batch([
      db
        .update(accounts)
        .set({ revision: sql`${accounts.revision} + 1`, updatedAt: params.now })
        .where(eq(accounts.accountId, params.accountId)),

      db.insert(vaults).values({
        vaultId: params.vaultId,
        accountId: params.accountId,
        version: 1,
        wrappedVaultKey: params.wrappedVaultKey,
        metadata: params.metadata,
        revision: bumped,
        updatedAt: params.now,
      }),
    ]),
  );

  if (!result.ok) return result;
  return ok(undefined);
};
