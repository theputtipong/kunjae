import { sql } from "drizzle-orm";
import { ok, type Result } from "@kunjae/core-crypto";

import { runQuery, type Db } from "./client.ts";
import type { DbError } from "./errors.ts";
import { usageSnapshots } from "./schema.ts";

type DbResult<T> = Result<T, DbError>;

export type UsageSample = {
  readonly accounts: number;
  readonly vaults: number;
  readonly items: number;
  readonly totalRevisions: number;
  readonly estimatedBytes: number;
};

export const sampleUsage = async (db: Db): Promise<DbResult<UsageSample>> => {
  const result = await runQuery(
    db.get<{
      accounts: number;
      vaults: number;
      items: number;
      total_revisions: number;
      estimated_bytes: number;
    }>(sql`
      SELECT
        (SELECT COUNT(*) FROM accounts) AS accounts,
        (SELECT COUNT(*) FROM vaults) AS vaults,
        (SELECT COUNT(*) FROM items) AS items,
        (SELECT COALESCE(SUM(revision), 0) FROM accounts) AS total_revisions,
        (SELECT COALESCE(SUM(LENGTH(envelope)), 0) FROM items)
          + (SELECT COALESCE(SUM(LENGTH(metadata)) + SUM(LENGTH(wrapped_vault_key)), 0) FROM vaults)
          AS estimated_bytes
    `),
  );

  if (!result.ok) return result;

  const row = result.value;
  return ok({
    accounts: row.accounts,
    vaults: row.vaults,
    items: row.items,
    totalRevisions: row.total_revisions,
    estimatedBytes: row.estimated_bytes,
  });
};

export type PreviousSnapshot = {
  readonly takenOn: string;
  readonly takenAt: string;
  readonly totalRevisions: number;
  readonly estimatedBytes: number;
};

export const previousSnapshot = async (
  db: Db,
  beforeDay: string,
): Promise<DbResult<PreviousSnapshot | null>> => {
  const result = await runQuery(
    db.get<
      | { taken_on: string; taken_at: string; total_revisions: number; estimated_bytes: number }
      | undefined
      | null
    >(sql`
      SELECT taken_on, taken_at, total_revisions, estimated_bytes
      FROM usage_snapshots
      WHERE taken_on < ${beforeDay}
      ORDER BY taken_on DESC
      LIMIT 1
    `),
  );

  if (!result.ok) return result;
  if (result.value === undefined || result.value === null) return ok(null);

  return ok({
    takenOn: result.value.taken_on,
    takenAt: result.value.taken_at,
    totalRevisions: result.value.total_revisions,
    estimatedBytes: result.value.estimated_bytes,
  });
};

export const recordSnapshot = async (
  db: Db,
  takenOn: string,
  takenAt: string,
  sample: UsageSample,
): Promise<DbResult<void>> => {
  const row = {
    takenOn,
    takenAt,
    accounts: sample.accounts,
    vaults: sample.vaults,
    items: sample.items,
    totalRevisions: sample.totalRevisions,
    estimatedBytes: sample.estimatedBytes,
  };

  const result = await runQuery(
    db
      .insert(usageSnapshots)
      .values(row)
      .onConflictDoUpdate({ target: usageSnapshots.takenOn, set: row }),
  );

  if (!result.ok) return result;
  return ok(undefined);
};
