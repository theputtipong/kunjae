import {
  DEFAULT_TOTP_ALGORITHM,
  DEFAULT_TOTP_DIGITS,
  DEFAULT_TOTP_PERIOD_SECONDS,
  TOTP_ALGORITHMS,
  decodeTotpSecret,
  err,
  invalidFormat,
  ok,
  totpFromSecretText,
  type CryptoResult,
  type TotpAlgorithm,
  type TotpCode,
} from "@kunjae/core-crypto";

import { FIELD_LIMITS, type DomainResult, type ItemContent, type LoginItem } from "./item-content.ts";

export type TotpConfig = {
  readonly secret: string;
  readonly algorithm: TotpAlgorithm;
  readonly digits: number;
  readonly periodSeconds: number;
};

const OTPAUTH_SCHEME = "otpauth://";
const TOTP_TYPE = "totp";

const invalidUri = () => err(invalidFormat("otpauth-uri"));

export const isOtpauthUri = (text: string): boolean =>
  text.trim().toLowerCase().startsWith(OTPAUTH_SCHEME);

export const cleanTotpSecret = (text: string): string =>
  text.replace(/[\s-]/gu, "").toUpperCase().replace(/=+$/u, "");

const decodeComponent = (text: string): string | null => {
  try {
    return decodeURIComponent(text);
  } catch {
    return null;
  }
};

const parseQuery = (query: string): Map<string, string> | null => {
  const params = new Map<string, string>();

  for (const part of query.split("&")) {
    if (part === "") continue;

    const eq = part.indexOf("=");
    const key = decodeComponent(eq < 0 ? part : part.slice(0, eq));
    const value = decodeComponent(eq < 0 ? "" : part.slice(eq + 1));
    if (key === null || value === null) return null;

    const name = key.toLowerCase();
    if (!params.has(name)) params.set(name, value);
  }

  return params;
};

const parseBoundedInt = (text: string | undefined, fallback: number, min: number, max: number): number | null => {
  if (text === undefined) return fallback;
  if (!/^\d{1,4}$/u.test(text)) return null;

  const value = Number(text);
  return value >= min && value <= max ? value : null;
};

const parseAlgorithm = (text: string | undefined): TotpAlgorithm | null => {
  if (text === undefined) return DEFAULT_TOTP_ALGORITHM;

  const name = text.toUpperCase().replace("-", "");
  return TOTP_ALGORITHMS.find((algorithm) => algorithm === name) ?? null;
};

const isDecodableSecret = (secret: string): boolean => {
  const bytes = decodeTotpSecret(secret);
  if (!bytes.ok) return false;
  bytes.value.fill(0);
  return true;
};

export const parseOtpauthUri = (text: string): CryptoResult<TotpConfig> => {
  const trimmed = text.trim();
  if (!trimmed.toLowerCase().startsWith(OTPAUTH_SCHEME)) return invalidUri();

  const rest = trimmed.slice(OTPAUTH_SCHEME.length);
  const typeEnd = rest.indexOf("/");
  if (typeEnd < 0 || rest.slice(0, typeEnd).toLowerCase() !== TOTP_TYPE) return invalidUri();

  const afterType = rest.slice(typeEnd + 1);
  const queryStart = afterType.indexOf("?");
  if (queryStart < 0) return invalidUri();

  const queryWithFragment = afterType.slice(queryStart + 1);
  const fragment = queryWithFragment.indexOf("#");
  const params = parseQuery(fragment < 0 ? queryWithFragment : queryWithFragment.slice(0, fragment));
  if (params === null) return invalidUri();

  const secret = cleanTotpSecret(params.get("secret") ?? "");
  if (secret === "" || !isDecodableSecret(secret)) return invalidUri();

  const algorithm = parseAlgorithm(params.get("algorithm"));
  const digits = parseBoundedInt(
    params.get("digits"),
    DEFAULT_TOTP_DIGITS,
    FIELD_LIMITS.totpDigitsMin,
    FIELD_LIMITS.totpDigitsMax,
  );
  const periodSeconds = parseBoundedInt(
    params.get("period"),
    DEFAULT_TOTP_PERIOD_SECONDS,
    FIELD_LIMITS.totpPeriodMin,
    FIELD_LIMITS.totpPeriodMax,
  );
  if (algorithm === null || digits === null || periodSeconds === null) return invalidUri();

  return ok({ secret, algorithm, digits, periodSeconds });
};

export const totpConfigOf = (login: LoginItem): CryptoResult<TotpConfig> => {
  if (isOtpauthUri(login.totpSecret)) return parseOtpauthUri(login.totpSecret);

  return ok({
    secret: login.totpSecret,
    algorithm: login.totpAlgorithm ?? DEFAULT_TOTP_ALGORITHM,
    digits: login.totpDigits ?? DEFAULT_TOTP_DIGITS,
    periodSeconds: login.totpPeriod ?? DEFAULT_TOTP_PERIOD_SECONDS,
  });
};

export const loginTotpCode = (login: LoginItem, nowMs: number): CryptoResult<TotpCode> => {
  const config = totpConfigOf(login);
  if (!config.ok) return config;

  return totpFromSecretText(config.value.secret, nowMs, {
    algorithm: config.value.algorithm,
    digits: config.value.digits,
    periodSeconds: config.value.periodSeconds,
  });
};

const normalizeLogin = (login: LoginItem): DomainResult<LoginItem> => {
  if (!isOtpauthUri(login.totpSecret)) return ok(login);

  const parsed = parseOtpauthUri(login.totpSecret);
  if (!parsed.ok) return err({ kind: "ItemContentInvalid", fields: ["totpSecret"] });

  const { secret, algorithm, digits, periodSeconds } = parsed.value;

  const next: LoginItem = { ...login, totpSecret: secret };
  delete next.totpAlgorithm;
  delete next.totpDigits;
  delete next.totpPeriod;

  if (algorithm !== DEFAULT_TOTP_ALGORITHM) next.totpAlgorithm = algorithm;
  if (digits !== DEFAULT_TOTP_DIGITS) next.totpDigits = digits;
  if (periodSeconds !== DEFAULT_TOTP_PERIOD_SECONDS) next.totpPeriod = periodSeconds;

  return ok(next);
};

export const normalizeItemContent = (content: ItemContent): DomainResult<ItemContent> =>
  content.type === "login" ? normalizeLogin(content) : ok(content);
