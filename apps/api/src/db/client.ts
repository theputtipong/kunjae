import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { fromPromise, type Result } from "@kunjae/core-crypto";

import * as schema from "./schema.ts";
import { classifyDbError, type DbError } from "./errors.ts";

export type Db = DrizzleD1Database<typeof schema>;

export const createDb = (d1: D1Database): Db => drizzle(d1, { schema });

export const runQuery = async <T>(query: Promise<T>): Promise<Result<T, DbError>> =>
  fromPromise(query, classifyDbError);
