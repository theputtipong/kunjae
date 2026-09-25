import type { MiddlewareHandler } from "hono";

const readAllowedOrigins = (env: unknown): readonly string[] => {
  if (typeof env !== "object" || env === null) return [];

  const raw: unknown = (env as Record<string, unknown>)["ALLOWED_ORIGINS"];
  if (typeof raw !== "string" || raw.length === 0) return [];

  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

const PREFLIGHT_MAX_AGE_SECONDS = 86_400;

export const cors = (): MiddlewareHandler<{ Bindings: Env }> => async (c, next) => {
  const origin = c.req.header("Origin");
  const allowed = readAllowedOrigins(c.env);

  const isAllowed = origin !== undefined && allowed.includes(origin);

  if (isAllowed) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Vary", "Origin");
  }

  if (c.req.method === "OPTIONS") {
    if (!isAllowed) return c.body(null, 403);

    c.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    c.header("Access-Control-Max-Age", String(PREFLIGHT_MAX_AGE_SECONDS));

    return c.body(null, 204);
  }

  return next();
};
