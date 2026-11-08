/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/d1";

import type { ServerSecrets } from "../config/secrets.ts";
import type { Db } from "../db/client.ts";
import * as schema from "../db/schema.ts";

export type SqliteD1Options = {
  readonly failWhen?: (query: string) => boolean;
  readonly afterQuery?: (query: string) => void;
};

export type TestDatabase = {
  readonly sqlite: DatabaseSync;
  readonly d1: D1Database;
  readonly db: Db;
};

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "migrations");

const applyMigrations = (sqlite: DatabaseSync): void => {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of files) {
    sqlite.exec(readFileSync(join(MIGRATIONS_DIR, name), "utf8"));
  }
};

type Row = Record<string, unknown>;

const createStatement = (
  sqlite: DatabaseSync,
  options: SqliteD1Options,
  query: string,
  params: readonly unknown[],
): unknown => {
  const guard = (): void => {
    if (options.failWhen?.(query) === true) throw new Error("D1_ERROR: injected failure");
  };
  const done = (): void => options.afterQuery?.(query);
  const values = params as SQLInputValue[];

  const all = (): Row[] => {
    guard();
    const rows = sqlite.prepare(query).all(...values) as Row[];
    done();
    return rows;
  };

  return {
    bind: (...next: unknown[]) => createStatement(sqlite, options, query, next),
    all: () => Promise.resolve().then(() => ({ results: all(), success: true, meta: {} })),
    raw: () => Promise.resolve().then(() => all().map((row) => Object.values(row))),
    first: () => Promise.resolve().then(() => all()[0] ?? null),
    run: () =>
      Promise.resolve().then(() => {
        guard();
        const info = sqlite.prepare(query).run(...values);
        done();
        return { results: [], success: true, meta: { changes: Number(info.changes) } };
      }),
    batchAll: all,
  };
};

type BatchStatement = { readonly batchAll: () => Row[] };

export const createTestDatabase = (options: SqliteD1Options = {}): TestDatabase => {
  const sqlite = new DatabaseSync(":memory:");
  applyMigrations(sqlite);

  const d1 = {
    prepare: (query: string) => createStatement(sqlite, options, query, []),
    batch: (statements: readonly BatchStatement[]) =>
      Promise.resolve().then(() => {
        sqlite.exec("BEGIN");
        try {
          const results = statements.map((statement) => ({
            results: statement.batchAll(),
            success: true,
            meta: {},
          }));
          sqlite.exec("COMMIT");
          return results;
        } catch (error) {
          sqlite.exec("ROLLBACK");
          throw error;
        }
      }),
  } as unknown as D1Database;

  return { sqlite, d1, db: drizzle(d1, { schema }) };
};

export const ACCOUNT_A = "01ARZ3NDEKTSV4RRFFQ69G5FAA";
export const ACCOUNT_B = "01ARZ3NDEKTSV4RRFFQ69G5FBB";
export const VAULT_A = "01ARZ3NDEKTSV4RRFFQ69G5VAA";
export const VAULT_B = "01ARZ3NDEKTSV4RRFFQ69G5VBB";

export const ENVELOPE = { v: 1, alg: "A256GCM", n: "bm9uY2U", ct: "Y2lwaGVy" } as const;

export const seedAccount = (
  sqlite: DatabaseSync,
  params: {
    readonly accountId: string;
    readonly email: string;
    readonly vaultId: string;
    readonly authKeyHash?: string;
    readonly tokenEpoch?: number;
    readonly revision?: number;
  },
): void => {
  const revision = params.revision ?? 1;
  sqlite
    .prepare(
      `INSERT INTO accounts (account_id, email, account_salt, argon2_memory_kib, argon2_iterations,
        argon2_parallelism, argon2_hash_length, auth_key_hash, token_epoch, revision, created_at, updated_at)
       VALUES (?, ?, 'c2FsdHNhbHRzYWx0c2FsdA', 65536, 3, 1, 32, ?, ?, ?, 'now', 'now')`,
    )
    .run(params.accountId, params.email, params.authKeyHash ?? "A".repeat(43), params.tokenEpoch ?? 0, revision);
  insertVaultRow(sqlite, params.accountId, params.vaultId, revision);
};

export const insertVaultRow = (sqlite: DatabaseSync, accountId: string, vaultId: string, revision: number): void => {
  const envelope = JSON.stringify(ENVELOPE);
  sqlite
    .prepare(
      `INSERT INTO vaults (vault_id, account_id, version, wrapped_vault_key, metadata, revision, updated_at)
       VALUES (?, ?, 1, ?, ?, ?, 'now')`,
    )
    .run(vaultId, accountId, envelope, envelope, revision);
};

export const scalar = (sqlite: DatabaseSync, query: string, ...params: SQLInputValue[]): unknown => {
  const row = sqlite.prepare(query).get(...params);
  return row === undefined ? undefined : Object.values(row)[0];
};

export const testSecrets = (): ServerSecrets => ({
  authPepper: new Uint8Array(32).fill(1),
  tokenSecret: new Uint8Array(32).fill(2),
  challengeKey: new Uint8Array(32).fill(3),
});
