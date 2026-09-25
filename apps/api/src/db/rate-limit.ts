import { sql } from "drizzle-orm";
import { ok } from "@kunjae/core-crypto";

import { runQuery, type Db } from "./client.ts";
import type { DbResult } from "./errors.ts";

export type RateLimitState = {
  readonly count: number;
  readonly allowed: boolean;
};

export const touchRateLimit = async (
  db: Db,
  bucket: string,
  nowSeconds: number,
  windowSeconds: number,
  limit: number,
): Promise<DbResult<RateLimitState>> => {
    const rows = await runQuery(
      db.all<{ count: number }>(sql`
        INSERT INTO rate_limits (bucket, window_start, count)
        VALUES (${bucket}, ${nowSeconds}, 1)
        ON CONFLICT(bucket) DO UPDATE SET
          window_start = CASE
            WHEN ${nowSeconds} - rate_limits.window_start >= ${windowSeconds}
              THEN ${nowSeconds}
            ELSE rate_limits.window_start
          END,
          count = CASE
            WHEN ${nowSeconds} - rate_limits.window_start >= ${windowSeconds}
              THEN 1
            ELSE rate_limits.count + 1
          END
        RETURNING count
      `),
    );

  if (!rows.ok) return rows;

  const count = rows.value[0]?.count ?? 1;
  return ok({ count, allowed: count <= limit });
};

export const pruneRateLimits = async (
  db: Db,
  olderThanSeconds: number,
): Promise<DbResult<unknown>> =>
  runQuery(db.run(sql`DELETE FROM rate_limits WHERE window_start < ${olderThanSeconds}`));
