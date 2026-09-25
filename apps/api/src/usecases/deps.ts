import type { ServerSecrets } from "../config/secrets.ts";
import type { Db } from "../db/client.ts";

export type Deps = {
  readonly db: Db;
  readonly secrets: ServerSecrets;
  readonly nowMs: number;
};

export const isoNow = (nowMs: number): string => new Date(nowMs).toISOString();
