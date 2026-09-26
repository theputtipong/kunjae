import { err, ok } from "@kunjae/core-crypto";

import type { Db } from "../db/client.ts";
import { pruneDailyUsage } from "../db/daily-usage.ts";
import { pruneRateLimits } from "../db/rate-limit.ts";
import { previousSnapshot, recordSnapshot, sampleUsage } from "../db/usage.ts";
import { internal, type UseCaseResult } from "./errors.ts";
import { buildUsageReport, type UsageReport } from "./usage-report.ts";

const MS_PER_DAY = 86_400_000;

export const readUsage = async (db: Db, now: Date): Promise<UseCaseResult<UsageReport>> => {
  const today = now.toISOString().slice(0, 10);

  const sample = await sampleUsage(db);
  if (!sample.ok) return err(internal());

  const previous = await previousSnapshot(db, today);
  if (!previous.ok) return err(internal());

  const before = previous.value;

  return ok(
    buildUsageReport({
      accounts: sample.value.accounts,
      vaults: sample.value.vaults,
      items: sample.value.items,
      totalRevisions: sample.value.totalRevisions,
      estimatedBytes: sample.value.estimatedBytes,
      previous:
        before === null
          ? null
          : {
              totalRevisions: before.totalRevisions,
              estimatedBytes: before.estimatedBytes,
              daysAgo: Math.max(
                1,
                Math.round((now.getTime() - new Date(before.takenAt).getTime()) / MS_PER_DAY),
              ),
            },
    }),
  );
};

const RATE_LIMIT_RETENTION_SECONDS = 3600;
const DAILY_USAGE_RETENTION_DAYS = 2;

export const runDailyUsageCheck = async (db: Db, now: Date): Promise<UseCaseResult<UsageReport>> => {
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const oldestDay = new Date(now.getTime() - DAILY_USAGE_RETENTION_DAYS * MS_PER_DAY).toISOString().slice(0, 10);
  const pruned = await Promise.all([
    pruneRateLimits(db, nowSeconds - RATE_LIMIT_RETENTION_SECONDS),
    pruneDailyUsage(db, oldestDay),
  ]);
  if (pruned.some((result) => !result.ok)) console.error("[usage] ลบตัวนับเก่าไม่สำเร็จ");

  const report = await readUsage(db, now);
  if (!report.ok) return report;

  const sample = await sampleUsage(db);
  if (!sample.ok) return err(internal());

  const written = await recordSnapshot(db, now.toISOString().slice(0, 10), now.toISOString(), sample.value);
  if (!written.ok) return err(internal());

  if (report.value.status !== "ok") {
    const line = `[usage] ${report.value.status} — ${report.value.message} · บัญชี ${String(report.value.accounts)} · รายการ ${String(report.value.items)}`;

    if (report.value.status === "critical") console.error(line);
    else console.warn(line);
  }

  return report;
};
