const FREE_STORAGE_BYTES = 5 * 1024 * 1024 * 1024;
const FREE_ROWS_WRITTEN_PER_DAY = 100_000;

const WARN_RATIO = 0.7;
const CRITICAL_RATIO = 0.9;

export type UsageStatus = "ok" | "warn" | "critical";

export type UsageReport = {
  readonly status: UsageStatus;
  readonly accounts: number;
  readonly vaults: number;
  readonly items: number;
  readonly estimatedBytes: number;
  readonly storageRatio: number;
  readonly writesPerDay: number | null;
  readonly writeRatio: number | null;
  readonly daysUntilStorageFull: number | null;
  readonly message: string;
};

export type UsageInput = {
  readonly accounts: number;
  readonly vaults: number;
  readonly items: number;
  readonly totalRevisions: number;
  readonly estimatedBytes: number;
  readonly previous: {
    readonly totalRevisions: number;
    readonly estimatedBytes: number;
    readonly daysAgo: number;
  } | null;
};

const worst = (values: readonly UsageStatus[]): UsageStatus =>
  values.includes("critical") ? "critical" : values.includes("warn") ? "warn" : "ok";

const ratioToStatus = (ratio: number): UsageStatus =>
  ratio >= CRITICAL_RATIO ? "critical" : ratio >= WARN_RATIO ? "warn" : "ok";

export const buildUsageReport = (input: UsageInput): UsageReport => {
  const storageRatio = input.estimatedBytes / FREE_STORAGE_BYTES;

  const writesPerDay =
    input.previous === null || input.previous.daysAgo <= 0
      ? null
      : (input.totalRevisions - input.previous.totalRevisions) / input.previous.daysAgo;

  const writeRatio = writesPerDay === null ? null : writesPerDay / FREE_ROWS_WRITTEN_PER_DAY;

  const bytesPerDay =
    input.previous === null || input.previous.daysAgo <= 0
      ? null
      : (input.estimatedBytes - input.previous.estimatedBytes) / input.previous.daysAgo;

  const daysUntilStorageFull =
    bytesPerDay === null || bytesPerDay <= 0
      ? null
      : Math.floor((FREE_STORAGE_BYTES - input.estimatedBytes) / bytesPerDay);

  const status = worst([
    ratioToStatus(storageRatio),
    writeRatio === null ? "ok" : ratioToStatus(writeRatio),
  ]);

  const percent = (ratio: number): string => `${(ratio * 100).toFixed(1)}%`;

  const parts = [
    `พื้นที่ ${percent(storageRatio)} ของเพดานฟรี`,
    writeRatio === null
      ? "การเขียนต่อวัน: ยังไม่มีข้อมูลของวันก่อนหน้าให้เทียบ"
      : `การเขียน ${percent(writeRatio)} ของโควตารายวัน`,
    daysUntilStorageFull === null
      ? "ยังประมาณวันที่พื้นที่จะเต็มไม่ได้"
      : `พื้นที่จะเต็มในอีกประมาณ ${String(daysUntilStorageFull)} วัน`,
  ];

  return {
    status,
    accounts: input.accounts,
    vaults: input.vaults,
    items: input.items,
    estimatedBytes: input.estimatedBytes,
    storageRatio,
    writesPerDay,
    writeRatio,
    daysUntilStorageFull,
    message: parts.join(" · "),
  };
};
