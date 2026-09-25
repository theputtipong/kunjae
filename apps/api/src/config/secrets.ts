import { base64UrlToBytes, err, invalidParameter, ok, type Bytes, type CryptoResult } from "@kunjae/core-crypto";

const MIN_SECRET_BYTES = 32;

export type ServerSecrets = {
  readonly authPepper: Bytes;
  readonly tokenSecret: Bytes;
  readonly challengeKey: Bytes;
};

type SecretName = "AUTH_PEPPER" | "TOKEN_SECRET" | "CHALLENGE_KEY";

const readOne = (env: unknown, name: SecretName): CryptoResult<Bytes> => {
  if (typeof env !== "object" || env === null) return err(invalidParameter(name));

  const raw: unknown = (env as Record<string, unknown>)[name];
  if (typeof raw !== "string" || raw.length === 0) return err(invalidParameter(name));

  const decoded = base64UrlToBytes(raw);
  if (!decoded.ok) return err(invalidParameter(name));
  if (decoded.value.length < MIN_SECRET_BYTES) return err(invalidParameter(name));

  return ok(decoded.value);
};

export const readServerSecrets = (env: unknown): CryptoResult<ServerSecrets> => {
  const authPepper = readOne(env, "AUTH_PEPPER");
  if (!authPepper.ok) return authPepper;

  const tokenSecret = readOne(env, "TOKEN_SECRET");
  if (!tokenSecret.ok) return tokenSecret;

  const challengeKey = readOne(env, "CHALLENGE_KEY");
  if (!challengeKey.ok) return challengeKey;

  return ok({
    authPepper: authPepper.value,
    tokenSecret: tokenSecret.value,
    challengeKey: challengeKey.value,
  });
};

export const readAdminToken = (env: unknown): string | null => {
  if (typeof env !== "object" || env === null) return null;

  const raw: unknown = (env as Record<string, unknown>)["ADMIN_TOKEN"];
  if (typeof raw !== "string" || raw.length === 0) return null;

  return raw;
};
