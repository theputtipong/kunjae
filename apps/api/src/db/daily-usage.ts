import { sql } from "drizzle-orm";
import { ok } from "@kunjae/core-crypto";

import { runQuery, type Db } from "./client.ts";
import type { DbResult } from "./errors.ts";

export type DailyBudget = {
  readonly maxPulls: number;
  readonly maxChanges: number;
};

export type DailySpend = {
  readonly pulls: number;
  readonly changes: number;
};

export const spendDailyBudget = async (
  db: Db,
  accountId: string,
  day: string,
  spend: DailySpend,
  budget: DailyBudget,
): Promise<DbResult<boolean>> => {
  if (spend.pulls > budget.maxPulls || spend.changes > budget.maxChanges) return ok(false);

  const rows = await runQuery(
    db.all<{ pulls: number }>(sql`
      INSERT INTO account_daily_usage (account_id, day, pulls, changes)
      VALUES (${accountId}, ${day}, ${spend.pulls}, ${spend.changes})
      ON CONFLICT(account_id, day) DO UPDATE SET
        pulls = account_daily_usage.pulls + ${spend.pulls},
        changes = account_daily_usage.changes + ${spend.changes}
      WHERE account_daily_usage.pulls + ${spend.pulls} <= ${budget.maxPulls}
        AND account_daily_usage.changes + ${spend.changes} <= ${budget.maxChanges}
      RETURNING pulls
    `),
  );
  if (!rows.ok) return rows;

  return ok(rows.value.length > 0);
};

export const pruneDailyUsage = async (db: Db, olderThanDay: string): Promise<DbResult<unknown>> =>
  runQuery(db.run(sql`DELETE FROM account_daily_usage WHERE day < ${olderThanDay}`));
