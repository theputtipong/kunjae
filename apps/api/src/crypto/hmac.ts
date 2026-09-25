import { err, ok, subtleCryptoUnavailable, type Bytes, type CryptoResult } from "@kunjae/core-crypto";

const HMAC_ALGORITHM = { name: "HMAC", hash: "SHA-256" } as const;

export const hmacSha256 = async (key: Bytes, message: Bytes): Promise<CryptoResult<Bytes>> => {
  try {
    const cryptoKey = await crypto.subtle.importKey("raw", key, HMAC_ALGORITHM, false, ["sign"]);
    const signature = await crypto.subtle.sign(HMAC_ALGORITHM.name, cryptoKey, message);
    return ok(new Uint8Array(signature));
  } catch {
    return err(subtleCryptoUnavailable());
  }
};
