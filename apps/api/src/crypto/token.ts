import {
  base64UrlToBytes,
  bytesToBase64Url,
  bytesToUtf8,
  constantTimeEqual,
  err,
  fromThrowable,
  invalidFormat,
  ok,
  utf8ToBytes,
  type Bytes,
  type CryptoResult,
} from "@kunjae/core-crypto";
import { z } from "zod";

import { hmacSha256 } from "./hmac.ts";

const TOKEN_PREFIX = "kunjae.tok.1.";

export const TOKEN_TTL_SECONDS = 3600;

const TokenClaimsSchema = z.strictObject({
  sub: z.string().length(26),
  ep: z.int().nonnegative(),
  exp: z.int().positive(),
});

export type TokenClaims = z.infer<typeof TokenClaimsSchema>;

const signPayload = async (secret: Bytes, encodedPayload: string): Promise<CryptoResult<string>> => {
  const message = utf8ToBytes(`${TOKEN_PREFIX}${encodedPayload}`);
  if (!message.ok) return message;

  const mac = await hmacSha256(secret, message.value);
  if (!mac.ok) return mac;

  return ok(bytesToBase64Url(mac.value));
};

const parseJson = (text: string): CryptoResult<unknown> =>
  fromThrowable(
    (): unknown => JSON.parse(text),
    () => invalidFormat("token"),
  );

export type IssueTokenParams = {
  readonly accountId: string;
  readonly tokenEpoch: number;
  readonly nowMs: number;
};

export type IssuedToken = {
  readonly token: string;
  readonly expiresAt: string;
};

export const issueToken = async (
  secret: Bytes,
  params: IssueTokenParams,
): Promise<CryptoResult<IssuedToken>> => {
  const expiresAtSeconds = Math.floor(params.nowMs / 1000) + TOKEN_TTL_SECONDS;

  const claims: TokenClaims = {
    sub: params.accountId,
    ep: params.tokenEpoch,
    exp: expiresAtSeconds,
  };

  const claimsBytes = utf8ToBytes(JSON.stringify(claims));
  if (!claimsBytes.ok) return claimsBytes;

  const encodedPayload = bytesToBase64Url(claimsBytes.value);

  const mac = await signPayload(secret, encodedPayload);
  if (!mac.ok) return mac;

  return ok({
    token: `${TOKEN_PREFIX}${encodedPayload}.${mac.value}`,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
  });
};

export const verifyToken = async (
  secret: Bytes,
  token: string,
  nowMs: number,
): Promise<CryptoResult<TokenClaims>> => {
  const invalid = err(invalidFormat("token"));

  if (!token.startsWith(TOKEN_PREFIX)) return invalid;

  const body = token.slice(TOKEN_PREFIX.length);
  const separator = body.indexOf(".");
  if (separator <= 0) return invalid;

  const encodedPayload = body.slice(0, separator);
  const providedMac = body.slice(separator + 1);
  if (providedMac.length === 0) return invalid;

  const expectedMac = await signPayload(secret, encodedPayload);
  if (!expectedMac.ok) return expectedMac;

  const expectedBytes = base64UrlToBytes(expectedMac.value);
  if (!expectedBytes.ok) return expectedBytes;

  const providedBytes = base64UrlToBytes(providedMac);
  if (!providedBytes.ok) return invalid;

  if (!constantTimeEqual(expectedBytes.value, providedBytes.value)) return invalid;

  const payloadBytes = base64UrlToBytes(encodedPayload);
  if (!payloadBytes.ok) return invalid;

  const payloadText = bytesToUtf8(payloadBytes.value);
  if (!payloadText.ok) return invalid;

  const parsed = parseJson(payloadText.value);
  if (!parsed.ok) return invalid;

  const claims = TokenClaimsSchema.safeParse(parsed.value);
  if (!claims.success) return invalid;

  if (claims.data.exp <= Math.floor(nowMs / 1000)) return invalid;

  return ok(claims.data);
};
