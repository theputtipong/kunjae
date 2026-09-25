import { eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { ok, type Result } from "@kunjae/core-crypto";

import { runQuery, type Db } from "./client.ts";
import type { DbError, DbResult } from "./errors.ts";
import { accounts, items, vaults } from "./schema.ts";

export type AccountAuthRow = {
  readonly accountId: string;
  readonly accountSalt: string;
  readonly argon2MemoryKib: number;
  readonly argon2Iterations: number;
  readonly argon2Parallelism: number;
  readonly argon2HashLength: number;
  readonly authKeyHash: string;
  readonly tokenEpoch: number;
};

export type CreateAccountParams = {
  readonly accountId: string;
  readonly email: string;
  readonly accountSalt: string;
  readonly argon2MemoryKib: number;
  readonly argon2Iterations: number;
  readonly argon2Parallelism: number;
  readonly argon2HashLength: number;
  readonly authKeyHash: string;
  readonly vaultId: string;
  readonly wrappedVaultKey: string;
  readonly metadata: string;
  readonly now: string;
};

export type RotateCredentialsParams = {
  readonly accountId: string;
  readonly accountSalt: string;
  readonly argon2MemoryKib: number;
  readonly argon2Iterations: number;
  readonly argon2Parallelism: number;
  readonly argon2HashLength: number;
  readonly authKeyHash: string;
  readonly rewrapped: readonly { readonly vaultId: string; readonly wrappedVaultKey: string }[];
  readonly now: string;
};

const ACCOUNT_AUTH_COLUMNS = {
  accountId: accounts.accountId,
  accountSalt: accounts.accountSalt,
  argon2MemoryKib: accounts.argon2MemoryKib,
  argon2Iterations: accounts.argon2Iterations,
  argon2Parallelism: accounts.argon2Parallelism,
  argon2HashLength: accounts.argon2HashLength,
  authKeyHash: accounts.authKeyHash,
  tokenEpoch: accounts.tokenEpoch,
} as const;

export const findAccountByEmail = async (
  db: Db,
  email: string,
): Promise<DbResult<AccountAuthRow | null>> => {
  const rows = await runQuery(
    db.select(ACCOUNT_AUTH_COLUMNS).from(accounts).where(eq(accounts.email, email)).limit(1),
  );

  if (!rows.ok) return rows;
  return ok(rows.value[0] ?? null);
};

export const findAccountById = async (
  db: Db,
  accountId: string,
): Promise<DbResult<AccountAuthRow | null>> => {
  const rows = await runQuery(
    db.select(ACCOUNT_AUTH_COLUMNS).from(accounts).where(eq(accounts.accountId, accountId)).limit(1),
  );

  if (!rows.ok) return rows;
  return ok(rows.value[0] ?? null);
};

export const findTokenEpoch = async (
  db: Db,
  accountId: string,
): Promise<DbResult<number | null>> => {
  const rows = await runQuery(
    db
      .select({ tokenEpoch: accounts.tokenEpoch })
      .from(accounts)
      .where(eq(accounts.accountId, accountId))
      .limit(1),
  );

  if (!rows.ok) return rows;
  return ok(rows.value[0]?.tokenEpoch ?? null);
};

export const createAccountWithVault = async (
  db: Db,
  params: CreateAccountParams,
): Promise<DbResult<void>> => {
  const FIRST_REVISION = 1;

  const result = await runQuery(
    db.batch([
      db.insert(accounts).values({
        accountId: params.accountId,
        email: params.email,
        accountSalt: params.accountSalt,
        argon2MemoryKib: params.argon2MemoryKib,
        argon2Iterations: params.argon2Iterations,
        argon2Parallelism: params.argon2Parallelism,
        argon2HashLength: params.argon2HashLength,
        authKeyHash: params.authKeyHash,
        tokenEpoch: 0,
        revision: FIRST_REVISION,
        createdAt: params.now,
        updatedAt: params.now,
      }),

      db.insert(vaults).values({
        vaultId: params.vaultId,
        accountId: params.accountId,
        version: 1,
        wrappedVaultKey: params.wrappedVaultKey,
        metadata: params.metadata,
        revision: FIRST_REVISION,
        updatedAt: params.now,
      }),
    ]),
  );

  if (!result.ok) return result;
  return ok(undefined);
};

export const rotateCredentials = async (
  db: Db,
  params: RotateCredentialsParams,
): Promise<DbResult<void>> => {
  const updateAccount = db
    .update(accounts)
    .set({
      accountSalt: params.accountSalt,
      argon2MemoryKib: params.argon2MemoryKib,
      argon2Iterations: params.argon2Iterations,
      argon2Parallelism: params.argon2Parallelism,
      argon2HashLength: params.argon2HashLength,
      authKeyHash: params.authKeyHash,
      tokenEpoch: sql`${accounts.tokenEpoch} + 1`,
      revision: sql`${accounts.revision} + 1`,
      updatedAt: params.now,
    })
    .where(eq(accounts.accountId, params.accountId));

  const currentRevision = sql`(SELECT ${accounts.revision} FROM ${accounts} WHERE ${accounts.accountId} = ${params.accountId})`;

  const updateVaults = params.rewrapped.map((vault) =>
    db
      .update(vaults)
      .set({
        wrappedVaultKey: vault.wrappedVaultKey,
        revision: currentRevision,
        updatedAt: params.now,
      })
      .where(sql`${vaults.vaultId} = ${vault.vaultId} AND ${vaults.accountId} = ${params.accountId}`),
  );

  const statements: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [
    updateAccount,
    ...updateVaults,
  ];

  const result: Result<unknown, DbError> = await runQuery(db.batch(statements));
  if (!result.ok) return result;
  return ok(undefined);
};

export const deleteAccount = async (db: Db, accountId: string): Promise<DbResult<void>> => {
  const statements: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [
    db.delete(items).where(eq(items.accountId, accountId)),
    db.delete(vaults).where(eq(vaults.accountId, accountId)),
    db.delete(accounts).where(eq(accounts.accountId, accountId)),
  ];

  const result: Result<unknown, DbError> = await runQuery(db.batch(statements));
  if (!result.ok) return result;
  return ok(undefined);
};

export const revokeAllTokens = async (
  db: Db,
  accountId: string,
  now: string,
): Promise<DbResult<void>> => {
  const result = await runQuery(
    db
      .update(accounts)
      .set({ tokenEpoch: sql`${accounts.tokenEpoch} + 1`, updatedAt: now })
      .where(eq(accounts.accountId, accountId)),
  );

  if (!result.ok) return result;
  return ok(undefined);
};
