import {
  base64UrlToBytes,
  bytesToBase64Url,
  constantTimeEqual,
  err,
  invalidFormat,
  ok,
  utf8ToBytes,
  type Bytes,
  type CryptoResult,
} from "@kunjae/core-crypto";

import { hmacSha256 } from "./hmac.ts";

const AUTH_KEY_LABEL = "kunjae.auth-key.v1|";

export const hashAuthKey = async (
  pepper: Bytes,
  authKeyBase64Url: string,
): Promise<CryptoResult<string>> => {
  const message = utf8ToBytes(`${AUTH_KEY_LABEL}${authKeyBase64Url}`);
  if (!message.ok) return message;

  const mac = await hmacSha256(pepper, message.value);
  if (!mac.ok) return mac;

  return ok(bytesToBase64Url(mac.value));
};

export const verifyAuthKey = async (
  pepper: Bytes,
  authKeyBase64Url: string,
  storedHashBase64Url: string,
): Promise<CryptoResult<boolean>> => {
  const computed = await hashAuthKey(pepper, authKeyBase64Url);
  if (!computed.ok) return computed;

  const computedBytes = base64UrlToBytes(computed.value);
  if (!computedBytes.ok) return computedBytes;

  const storedBytes = base64UrlToBytes(storedHashBase64Url);
  if (!storedBytes.ok) return err(invalidFormat("authKeyHash"));

  return ok(constantTimeEqual(computedBytes.value, storedBytes.value));
};
