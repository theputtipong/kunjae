import type { Context, MiddlewareHandler } from "hono";

import { hmacSha256 } from "../crypto/hmac.ts";
import { readServerSecrets } from "../config/secrets.ts";
import { touchRateLimit } from "../db/rate-limit.ts";
import { createDb } from "../db/client.ts";
import { bytesToBase64Url, utf8ToBytes, type Bytes } from "@kunjae/core-crypto";

import { underEdgeLimit } from "./edge-limit.ts";
import { errorPayload } from "./responses.ts";

export type RateLimitOptions = {
  readonly windowSeconds: number;
  readonly maxRequests: number;
  readonly failClosed?: boolean;
};

const DEFAULT_LIMIT: RateLimitOptions = { windowSeconds: 60, maxRequests: 12 };

const RATE_LIMIT_LABEL = "kunjae.ratelimit.v1|";

const ACCOUNT_LIMIT_LABEL = "kunjae.ratelimit.account.v1|";

const BUCKET_BYTES = 16;

const bucketOf = async (challengeKey: Bytes, text: string): Promise<string | null> => {
  const message = utf8ToBytes(text);
  if (!message.ok) return null;

  const mac = await hmacSha256(challengeKey, message.value);
  if (!mac.ok) return null;

  return bytesToBase64Url(mac.value.slice(0, BUCKET_BYTES));
};

export const accountBucketFor = (challengeKey: Bytes, scope: string, email: string): Promise<string | null> =>
  bucketOf(challengeKey, `${ACCOUNT_LIMIT_LABEL}${scope}|${email}`);

const rejected = (c: Context, limit: RateLimitOptions): Response => {
  const payload = errorPayload(429, "RATE_LIMITED");
  c.header("Retry-After", String(limit.windowSeconds));
  return c.json(payload.body, payload.status);
};

const unavailable = (c: Context): Response => {
  const payload = errorPayload(500, "INTERNAL");
  return c.json(payload.body, payload.status);
};

export const rateLimit =
  (limit: RateLimitOptions = DEFAULT_LIMIT): MiddlewareHandler<{ Bindings: Env }> =>
  async (c, next) => {
  const failClosed = limit.failClosed === true;

  const secrets = readServerSecrets(c.env);
  if (!secrets.ok) return failClosed ? unavailable(c) : next();

  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";

  const bucket = await bucketOf(secrets.value.challengeKey, `${RATE_LIMIT_LABEL}${new URL(c.req.url).pathname}|${ip}`);
  if (bucket === null) return failClosed ? unavailable(c) : next();

  if (!(await underEdgeLimit(c.env.PUBLIC_LIMITER, bucket, failClosed))) return rejected(c, limit);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const db = createDb(c.env.DB);

  const state = await touchRateLimit(db, bucket, nowSeconds, limit.windowSeconds, limit.maxRequests);
  if (!state.ok) return failClosed ? unavailable(c) : next();

  if (!state.value.allowed) return rejected(c, limit);

  return next();
};
