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
        WHERE rate_limits.count < ${limit}
          OR ${nowSeconds} - rate_limits.window_start >= ${windowSeconds}
        RETURNING count
      `),
    );

  if (!rows.ok) return rows;

  const row = rows.value[0];
  if (row === undefined) return ok({ count: limit + 1, allowed: false });

  return ok({ count: row.count, allowed: row.count <= limit });
};

export const pruneRateLimits = async (
  db: Db,
  olderThanSeconds: number,
): Promise<DbResult<unknown>> =>
  runQuery(db.run(sql`DELETE FROM rate_limits WHERE window_start < ${olderThanSeconds}`));
