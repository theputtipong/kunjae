import { err, ok, invalidParameter, type CryptoResult } from "@kunjae/core-crypto";

let baseUrl: string | null = null;

const isSafeApiUrl = (url: URL): boolean => {
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && url.hostname === "127.0.0.1";
};

export const configureApi = (rawUrl: string): CryptoResult<string> => {
  if (rawUrl.length === 0) return err(invalidParameter("apiBaseUrl"));

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return err(invalidParameter("apiBaseUrl"));
  }

  if (!isSafeApiUrl(parsed)) return err(invalidParameter("apiBaseUrl"));

  baseUrl = rawUrl.replace(/\/+$/u, "");
  return ok(baseUrl);
};

export const getApiBaseUrl = (): string => {
  if (baseUrl === null) throw new Error("ยังไม่ได้เรียก configureApi");
  return baseUrl;
};
