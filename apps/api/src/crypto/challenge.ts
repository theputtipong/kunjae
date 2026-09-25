import {
  ARGON2_PARAMS_V1,
  bytesToBase64Url,
  ok,
  utf8ToBytes,
  type Bytes,
  type CryptoResult,
} from "@kunjae/core-crypto";
import type { KdfChallenge } from "@kunjae/contracts";

import { hmacSha256 } from "./hmac.ts";

const DECOY_LABEL = "kunjae.decoy.v1|";

export const buildDecoyChallenge = async (
  challengeKey: Bytes,
  normalizedEmail: string,
): Promise<CryptoResult<KdfChallenge>> => {
  const message = utf8ToBytes(`${DECOY_LABEL}${normalizedEmail}`);
  if (!message.ok) return message;

  const mac = await hmacSha256(challengeKey, message.value);
  if (!mac.ok) return mac;

  return ok({
    accountSalt: bytesToBase64Url(mac.value),

    argon2: ARGON2_PARAMS_V1,
  });
};
