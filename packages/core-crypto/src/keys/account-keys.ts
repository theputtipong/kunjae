import { ok } from "../result.ts";
import type { CryptoResult } from "../errors.ts";
import type { Brand, Bytes } from "../types.ts";
import { wipe } from "../primitives/bytes.ts";
import { bytesToBase64Url } from "../primitives/encoding.ts";
import { deriveKey256, KEY_PURPOSE } from "../primitives/hkdf.ts";
import {
  deriveMasterUnlockKey,
  type AccountSalt,
  type DeriveMukParams,
  type MasterUnlockKey,
} from "./muk.ts";

export type AuthKey = Brand<Bytes, "AuthKey">;

export type WrappingKey = Brand<Bytes, "WrappingKey">;

export type AccountKeys = {
  readonly authKey: AuthKey;
  readonly wrappingKey: WrappingKey;
};

export const ACCOUNT_KEY_BYTES = 32;

export const deriveAccountKeys = (
  muk: MasterUnlockKey,
  accountSalt: AccountSalt,
): CryptoResult<AccountKeys> => {
  const auth = deriveKey256(muk, accountSalt, KEY_PURPOSE.AUTHENTICATION);
  if (!auth.ok) return auth;

  const wrapping = deriveKey256(muk, accountSalt, KEY_PURPOSE.VAULT_KEY_WRAPPING);
  if (!wrapping.ok) {
    wipe(auth.value);
    return wrapping;
  }

  return ok({
    authKey: auth.value as AuthKey,
    wrappingKey: wrapping.value as WrappingKey,
  });
};

export const unlockAccount = async (
  params: DeriveMukParams,
): Promise<CryptoResult<AccountKeys>> => {
  const muk = await deriveMasterUnlockKey(params);
  if (!muk.ok) return muk;

  try {
    return deriveAccountKeys(muk.value, params.accountSalt);
  } finally {
    wipe(muk.value);
  }
};

export const wipeAccountKeys = (keys: AccountKeys): void => {
  wipe(keys.authKey);
  wipe(keys.wrappingKey);
};

export const encodeAuthKey = (authKey: AuthKey): string => bytesToBase64Url(authKey);
