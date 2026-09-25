import { and, eq, gt, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { ok, type Result } from "@kunjae/core-crypto";

import { runQuery, type Db } from "./client.ts";
import type { DbError, DbResult } from "./errors.ts";
import { accounts, items } from "./schema.ts";

export type ItemRow = {
  readonly itemId: string;
  readonly vaultId: string;
  readonly version: number;
  readonly deleted: boolean;
  readonly envelope: string | null;
  readonly revision: number;
  readonly updatedAt: string;
};

export type ItemState = {
  readonly itemId: string;
  readonly vaultId: string;
  readonly version: number;
};

export type ItemWrite = {
  readonly itemId: string;
  readonly vaultId: string;
  readonly version: number;
  readonly baseVersion: number;
  readonly deleted: boolean;
  readonly envelope: string | null;
};

export type AppliedItem = {
  readonly itemId: string;
  readonly version: number;
  readonly updatedAt: string;
};

const ITEM_COLUMNS = {
  itemId: items.itemId,
  vaultId: items.vaultId,
  version: items.version,
  deleted: items.deleted,
  envelope: items.envelope,
  revision: items.revision,
  updatedAt: items.updatedAt,
} as const;

export const listItemsSince = async (
  db: Db,
  accountId: string,
  since: number,
  limit: number,
): Promise<DbResult<ItemRow[]>> =>
  runQuery(
    db
      .select(ITEM_COLUMNS)
      .from(items)
      .where(and(eq(items.accountId, accountId), gt(items.revision, since)))
      .orderBy(items.revision)
      .limit(limit)
      .all(),
  );

export const findItemStates = async (
  db: Db,
  accountId: string,
  itemIds: readonly string[],
): Promise<DbResult<ItemState[]>> => {
  if (itemIds.length === 0) return ok([]);

  return runQuery(
    db
      .select({ itemId: items.itemId, vaultId: items.vaultId, version: items.version })
      .from(items)
      .where(and(eq(items.accountId, accountId), sql`${items.itemId} IN ${itemIds}`))
      .all(),
  );
};

const isAppliedItem = (value: unknown): value is AppliedItem => {
  if (typeof value !== "object" || value === null) return false;
  return (
    typeof Reflect.get(value, "itemId") === "string" &&
    typeof Reflect.get(value, "version") === "number" &&
    typeof Reflect.get(value, "updatedAt") === "string"
  );
};

export const applyItemWrites = async (
  db: Db,
  accountId: string,
  writes: readonly ItemWrite[],
  now: string,
): Promise<DbResult<AppliedItem[]>> => {
  if (writes.length === 0) return ok([]);

  const total = writes.length;

  const reserveRevisions = db
    .update(accounts)
    .set({ revision: sql`${accounts.revision} + ${total}`, updatedAt: now })
    .where(eq(accounts.accountId, accountId));

  const upserts = writes.map((write, index) => {
    const offset = total - 1 - index;

    const assignedRevision = sql`((SELECT ${accounts.revision} FROM ${accounts} WHERE ${accounts.accountId} = ${accountId}) - ${offset})`;

    return db
      .insert(items)
      .values({
        itemId: write.itemId,
        accountId,
        vaultId: write.vaultId,
        version: write.version,
        deleted: write.deleted,
        envelope: write.envelope,
        revision: assignedRevision,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: items.itemId,
        set: {
          vaultId: write.vaultId,
          version: write.version,
          deleted: write.deleted,
          envelope: write.envelope,
          revision: assignedRevision,
          updatedAt: now,
        },
        setWhere: sql`${items.accountId} = ${accountId} AND ${items.version} = ${write.baseVersion}`,
      })
      .returning({
        itemId: items.itemId,
        version: items.version,
        updatedAt: items.updatedAt,
      });
  });

  const statements: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [
    reserveRevisions,
    ...upserts,
  ];

  const result: Result<unknown[], DbError> = await runQuery(db.batch(statements));
  if (!result.ok) return result;

  const applied = result.value
    .slice(1)
    .flatMap((rows: unknown) => (Array.isArray(rows) ? rows.filter(isAppliedItem) : []));

  return ok(applied);
};

export const currentRevision = async (db: Db, accountId: string): Promise<DbResult<number>> => {
  const rows = await runQuery(
    db
      .select({ revision: accounts.revision })
      .from(accounts)
      .where(eq(accounts.accountId, accountId))
      .limit(1),
  );

  if (!rows.ok) return rows;
  return ok(rows.value[0]?.revision ?? 0);
};
