import {
  ChangeMasterPasswordRequestSchema,
  ContactRequestSchema,
  CreateVaultRequestSchema,
  DeleteAccountRequestSchema,
  RevokeSessionsRequestSchema,
  LoginBeginRequestSchema,
  LoginFinishRequestSchema,
  SignUpRequestSchema,
  SyncPullRequestSchema,
  SyncPushRequestSchema,
} from "@kunjae/contracts";
import { constantTimeEqual } from "@kunjae/core-crypto";
import { captureException } from "@sentry/cloudflare";
import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";
import type { z } from "zod";

import { readContactConfig } from "../config/contact.ts";
import { readAdminToken, readServerSecrets } from "../config/secrets.ts";
import { touchRateLimit } from "../db/rate-limit.ts";
import { submitContact } from "../usecases/contact.ts";
import { createDb } from "../db/client.ts";
import { authenticate, type Identity } from "../usecases/authenticate.ts";
import { changeMasterPassword } from "../usecases/change-password.ts";
import { createVault } from "../usecases/create-vault.ts";
import { deleteAccount } from "../usecases/delete-account.ts";
import { revokeSessions } from "../usecases/revoke-sessions.ts";
import type { Deps } from "../usecases/deps.ts";
import type { UseCaseResult } from "../usecases/errors.ts";
import { readUsage } from "../usecases/check-usage.ts";
import { loginBegin, loginFinish } from "../usecases/login.ts";
import { signUp } from "../usecases/sign-up.ts";
import { syncPull, syncPush } from "../usecases/sync.ts";
import { cors } from "./cors.ts";
import { spendDailyBudget } from "../db/daily-usage.ts";
import { underEdgeLimit, type EdgeLimiter } from "./edge-limit.ts";
import { rateLimit } from "./rate-limit.ts";
import { errorPayload, newRequestId, toErrorPayload } from "./responses.ts";

type Variables = {
  deps: Deps;
  identity: Identity;
};

type App = { Bindings: Env; Variables: Variables };

const MAX_BODY_BYTES = 1_048_576;

const RETRY_AFTER_SECONDS = 60;

const CONTACT_PER_IP = { windowSeconds: 3600, maxRequests: 5 } as const;

const CONTACT_DAILY_CAP = 50;

const SECONDS_PER_DAY = 86_400;

const DAILY_BUDGET = { maxPulls: 500, maxChanges: 3000 } as const;

type LimitClass = "sync-pull" | "sync-push" | "sensitive";

const limiterFor = (env: Env, kind: LimitClass): EdgeLimiter | undefined =>
  kind === "sensitive" ? env.SENSITIVE_LIMITER : env.SYNC_LIMITER;

export const createApp = (): Hono<App> => {
  const app = new Hono<App>();

  app.use("*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Cross-Origin-Resource-Policy", "same-origin");
    c.header("X-Frame-Options", "DENY");
  });

  app.use("*", cors());

  app.use("*", async (c, next) => {
    const secrets = readServerSecrets(c.env);
    if (!secrets.ok) {
      const payload = errorPayload(500, "INTERNAL");
      return c.json(payload.body, payload.status);
    }

    c.set("deps", {
      db: createDb(c.env.DB),
      secrets: secrets.value,
      nowMs: Date.now(),
    });

    return next();
  });

  const tooMany = (c: Context<App>): Response => {
    const payload = errorPayload(429, "RATE_LIMITED");
    c.header("Retry-After", String(RETRY_AFTER_SECONDS));
    return c.json(payload.body, payload.status);
  };

  const requireAuth =
    (kind: LimitClass): MiddlewareHandler<App> =>
    async (c, next) => {
      const header = c.req.header("Authorization") ?? "";

      const PREFIX = "Bearer ";
      if (!header.startsWith(PREFIX)) {
        const payload = errorPayload(401, "UNAUTHORIZED");
        return c.json(payload.body, payload.status);
      }

      const identity = await authenticate(c.get("deps"), header.slice(PREFIX.length).trim(), (accountId) =>
        underEdgeLimit(limiterFor(c.env, kind), `${kind}|${accountId}`),
      );
      if (!identity.ok) {
        if (identity.error.kind === "RateLimited") return tooMany(c);
        const payload = toErrorPayload(identity.error);
        return c.json(payload.body, payload.status);
      }

      c.set("identity", identity.value);
      return next();
    };

  const withinDailyBudget = async (c: Context<App>, pulls: number, changes: number): Promise<boolean | null> => {
    const deps = c.get("deps");
    const day = new Date(deps.nowMs).toISOString().slice(0, 10);
    const spent = await spendDailyBudget(deps.db, c.get("identity").accountId, day, { pulls, changes }, DAILY_BUDGET);
    return spent.ok ? spent.value : null;
  };

  const internalError = (c: Context<App>): Response => {
    const payload = errorPayload(500, "INTERNAL");
    return c.json(payload.body, payload.status);
  };

  const readBody = async <S extends z.ZodType>(
    c: Context<App>,
    schema: S,
  ): Promise<z.infer<S> | null> => {
    const length = Number(c.req.header("Content-Length") ?? "0");
    if (Number.isFinite(length) && length > MAX_BODY_BYTES) return null;

    try {
      const raw: unknown = await c.req.json();
      const parsed = schema.safeParse(raw);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  };

  const respond = <T>(c: Context<App>, result: UseCaseResult<T>): Response => {
    if (!result.ok) {
      const payload = toErrorPayload(result.error);
      return c.json(payload.body, payload.status);
    }
    return c.json(result.value, 200);
  };

  const badRequest = (c: Context<App>): Response => {
    const payload = errorPayload(400, "INVALID_REQUEST");
    return c.json(payload.body, payload.status);
  };

  app.get("/health", (c) => c.json({ status: "ok" as const }));

  app.get("/v1/admin/usage", async (c) => {
    const configured = readAdminToken(c.env);
    if (configured === null) return c.notFound();

    const provided = c.req.header("x-admin-token") ?? "";

    const encoder = new TextEncoder();
    const toBytes = (text: string): Uint8Array<ArrayBuffer> => Uint8Array.from(encoder.encode(text));
    if (!constantTimeEqual(toBytes(configured), toBytes(provided))) {
      return c.notFound();
    }

    const report = await readUsage(c.get("deps").db, new Date(c.get("deps").nowMs));
    return respond(c, report);
  });

  app.post("/v1/auth/sign-up", rateLimit(), async (c) => {
    const body = await readBody(c, SignUpRequestSchema);
    if (body === null) return badRequest(c);

    return respond(c, await signUp(c.get("deps"), body));
  });

  app.post("/v1/auth/login/begin", rateLimit(), async (c) => {
    const body = await readBody(c, LoginBeginRequestSchema);
    if (body === null) return badRequest(c);

    return respond(c, await loginBegin(c.get("deps"), body));
  });

  app.post("/v1/auth/login/finish", rateLimit(), async (c) => {
    const body = await readBody(c, LoginFinishRequestSchema);
    if (body === null) return badRequest(c);

    return respond(c, await loginFinish(c.get("deps"), body));
  });

  app.post("/v1/contact", rateLimit(CONTACT_PER_IP), async (c) => {
    const config = readContactConfig(c.env);
    if (config === null) {
      const payload = errorPayload(503, "UNAVAILABLE");
      return c.json(payload.body, payload.status);
    }

    const body = await readBody(c, ContactRequestSchema);
    if (body === null) return badRequest(c);

    const deps = c.get("deps");
    const nowSeconds = Math.floor(deps.nowMs / 1000);
    const day = new Date(deps.nowMs).toISOString().slice(0, 10);
    const cap = await touchRateLimit(deps.db, `contact-daily|${day}`, nowSeconds, SECONDS_PER_DAY, CONTACT_DAILY_CAP);
    if (!cap.ok) return internalError(c);
    if (!cap.value.allowed) return tooMany(c);

    const result = await submitContact(deps, config, body, newRequestId());
    if (!result.ok) {
      const payload = errorPayload(503, "UNAVAILABLE");
      return c.json(payload.body, payload.status);
    }
    return c.json(result.value, 200);
  });

  app.post("/v1/auth/change-password", requireAuth("sensitive"), async (c) => {
    const body = await readBody(c, ChangeMasterPasswordRequestSchema);
    if (body === null) return badRequest(c);

    return respond(c, await changeMasterPassword(c.get("deps"), c.get("identity").accountId, body));
  });

  app.post("/v1/account/delete", requireAuth("sensitive"), async (c) => {
    const body = await readBody(c, DeleteAccountRequestSchema);
    if (body === null) return badRequest(c);

    return respond(c, await deleteAccount(c.get("deps"), c.get("identity").accountId, body));
  });

  app.post("/v1/auth/revoke-sessions", requireAuth("sensitive"), async (c) => {
    const body = await readBody(c, RevokeSessionsRequestSchema);
    if (body === null) return badRequest(c);

    return respond(c, await revokeSessions(c.get("deps"), c.get("identity").accountId, body));
  });

  app.post("/v1/vaults", requireAuth("sensitive"), async (c) => {
    const body = await readBody(c, CreateVaultRequestSchema);
    if (body === null) return badRequest(c);

    return respond(c, await createVault(c.get("deps"), c.get("identity").accountId, body));
  });

  app.post("/v1/sync/pull", requireAuth("sync-pull"), async (c) => {
    const body = await readBody(c, SyncPullRequestSchema);
    if (body === null) return badRequest(c);

    const allowed = await withinDailyBudget(c, 1, 0);
    if (allowed === null) return internalError(c);
    if (!allowed) return tooMany(c);

    return respond(c, await syncPull(c.get("deps"), c.get("identity").accountId, body));
  });

  app.post("/v1/sync/push", requireAuth("sync-push"), async (c) => {
    const body = await readBody(c, SyncPushRequestSchema);
    if (body === null) return badRequest(c);

    const allowed = await withinDailyBudget(c, 0, body.changes.length);
    if (allowed === null) return internalError(c);
    if (!allowed) return tooMany(c);

    return respond(c, await syncPush(c.get("deps"), c.get("identity").accountId, body));
  });

  app.notFound((c) => {
    const payload = errorPayload(404, "NOT_FOUND");
    return c.json(payload.body, payload.status);
  });

  app.onError((error, c) => {
    const payload = errorPayload(500, "INTERNAL");
    console.error(`unhandled error requestId=${payload.body.requestId}`);
    captureException(error, { tags: { requestId: payload.body.requestId } });
    return c.json(payload.body, payload.status);
  });

  return app;
};
