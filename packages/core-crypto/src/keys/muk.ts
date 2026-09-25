import { ok, err } from "../result.ts";
import { invalidParameter, type CryptoResult } from "../errors.ts";
import type { Brand, Bytes } from "../types.ts";
import { concatBytes, wipe } from "../primitives/bytes.ts";
import { deriveKey256, KEY_PURPOSE } from "../primitives/hkdf.ts";
import { deriveKeyFromPassword, type Argon2Params } from "../primitives/argon2.ts";
import { randomBytes } from "../primitives/random.ts";
import type { SecretKey } from "./secret-key.ts";

export type MasterUnlockKey = Brand<Bytes, "MasterUnlockKey">;

export type AccountSalt = Brand<Bytes, "AccountSalt">;

export const ACCOUNT_SALT_BYTES = 32;

const MIN_ACCOUNT_SALT_BYTES = 16;

export const MUK_BYTES = 32;

export const generateAccountSalt = (): CryptoResult<AccountSalt> => {
  const drawn = randomBytes(ACCOUNT_SALT_BYTES);
  if (!drawn.ok) return drawn;
  return ok(drawn.value as AccountSalt);
};

export const toAccountSalt = (bytes: Bytes): CryptoResult<AccountSalt> =>
  bytes.length >= MIN_ACCOUNT_SALT_BYTES
    ? ok(bytes as AccountSalt)
    : err(invalidParameter("accountSalt"));

export type DeriveMukParams = {
  readonly masterPassword: Bytes;
  readonly secretKey: SecretKey;
  readonly accountSalt: AccountSalt;
  readonly argon2: Argon2Params;
};

export const deriveMasterUnlockKey = async (
  params: DeriveMukParams,
): Promise<CryptoResult<MasterUnlockKey>> => {
  const { masterPassword, secretKey, accountSalt, argon2 } = params;

  if (masterPassword.length === 0) return err(invalidParameter("masterPassword"));

  const kPassword = await deriveKeyFromPassword(masterPassword, accountSalt, argon2);
  if (!kPassword.ok) return kPassword;

  const kSecret = deriveKey256(secretKey, accountSalt, KEY_PURPOSE.SECRET_KEY_STRETCH);
  if (!kSecret.ok) {
    wipe(kPassword.value);
    return kSecret;
  }

  const combined = concatBytes(kPassword.value, kSecret.value);
  wipe(kPassword.value);
  wipe(kSecret.value);

  const muk = deriveKey256(combined, accountSalt, KEY_PURPOSE.MASTER_UNLOCK_KEY);
  wipe(combined);

  if (!muk.ok) return muk;
  return ok(muk.value as MasterUnlockKey);
};
