import type { MiddlewareHandler } from "hono";

import { hmacSha256 } from "../crypto/hmac.ts";
import { readServerSecrets } from "../config/secrets.ts";
import { pruneRateLimits, touchRateLimit } from "../db/rate-limit.ts";
import { createDb } from "../db/client.ts";
import { bytesToBase64Url, utf8ToBytes } from "@kunjae/core-crypto";

import { errorPayload } from "./responses.ts";

const WINDOW_SECONDS = 60;
const MAX_REQUESTS_PER_WINDOW = 12;

const PRUNE_EVERY = 200;

const PRUNE_OLDER_THAN_SECONDS = 3600;

const RATE_LIMIT_LABEL = "kunjae.ratelimit.v1|";

const BUCKET_BYTES = 16;

const bucketFor = async (
  challengeKey: Uint8Array<ArrayBuffer>,
  path: string,
  ip: string,
): Promise<string | null> => {
  const message = utf8ToBytes(`${RATE_LIMIT_LABEL}${path}|${ip}`);
  if (!message.ok) return null;

  const mac = await hmacSha256(challengeKey, message.value);
  if (!mac.ok) return null;

  return bytesToBase64Url(mac.value.slice(0, BUCKET_BYTES));
};

export const rateLimit = (): MiddlewareHandler<{ Bindings: Env }> => async (c, next) => {
  const secrets = readServerSecrets(c.env);
  if (!secrets.ok) return next();

  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";

  const bucket = await bucketFor(secrets.value.challengeKey, new URL(c.req.url).pathname, ip);
  if (bucket === null) return next();

  const nowSeconds = Math.floor(Date.now() / 1000);
  const db = createDb(c.env.DB);

  const state = await touchRateLimit(db, bucket, nowSeconds, WINDOW_SECONDS, MAX_REQUESTS_PER_WINDOW);
  if (!state.ok) return next();

  if (state.value.count % PRUNE_EVERY === 0) {
    await pruneRateLimits(db, nowSeconds - PRUNE_OLDER_THAN_SECONDS);
  }

  if (!state.value.allowed) {
    const payload = errorPayload(429, "RATE_LIMITED");
    c.header("Retry-After", String(WINDOW_SECONDS));
    return c.json(payload.body, payload.status);
  }

  return next();
};
