import { ok, err } from "../result.ts";
import { invalidParameter, type CryptoResult } from "../errors.ts";
import type { Bytes } from "../types.ts";
import { wipe } from "../primitives/bytes.ts";
import { deriveKey256, LOCAL_KEY_PURPOSE } from "../primitives/hkdf.ts";
import { deriveKeyFromPassword, type Argon2Params } from "../primitives/argon2.ts";
import type { WrappingKey } from "./account-keys.ts";
import type { AccountSalt } from "./muk.ts";

export type DeriveLocalWrappingKeyParams = {
  readonly masterPassword: Bytes;
  readonly salt: AccountSalt;
  readonly argon2: Argon2Params;
};

export const deriveLocalWrappingKey = async (
  params: DeriveLocalWrappingKeyParams,
): Promise<CryptoResult<WrappingKey>> => {
  const { masterPassword, salt, argon2 } = params;

  if (masterPassword.length === 0) return err(invalidParameter("masterPassword"));

  const kPassword = await deriveKeyFromPassword(masterPassword, salt, argon2);
  if (!kPassword.ok) return kPassword;

  try {
    const wrapping = deriveKey256(kPassword.value, salt, LOCAL_KEY_PURPOSE.LOCAL_VAULT_WRAPPING);
    if (!wrapping.ok) return wrapping;

    return ok(wrapping.value as WrappingKey);
  } finally {
    wipe(kPassword.value);
  }
};
