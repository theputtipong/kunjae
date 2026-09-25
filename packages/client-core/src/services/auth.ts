import {
  ARGON2_PARAMS_V1,
  base64UrlToBytes,
  bytesToBase64Url,
  constantTimeEqual,
  encodeAuthKey,
  err,
  generateAccountSalt,
  generateSecretKey,
  formatSecretKey,
  importVaultKey,
  ok,
  parseSecretKey,
  toAccountSalt,
  toWrappedVaultKey,
  unlockAccount,
  unwrapVaultKey,
  utf8ToBytes,
  wrapVaultKey,
  validateArgon2Params,
  wipe,
  wipeAccountKeys,
  wipeVaultKey,
  type AccountKeys,
  type Argon2Params,
  type SecretKey,
  type WrappingKey,
} from "@kunjae/core-crypto";
import { createVault } from "@kunjae/domain";
import type { VaultKeyBundle } from "@kunjae/contracts";

import {
  apiChangeMasterPassword,
  apiDeleteAccount,
  apiRevokeSessions,
  apiLoginBegin,
  apiLoginFinish,
  apiSignUp,
} from "../api/client.ts";
import { createUlid } from "../lib/ulid.ts";
import {
  getSessionEmail,
  getSessionView,
  getUsableToken,
  lockSession,
  openSession,
  replaceToken,
  withAuthKey,
  withWrappingKey,
  type UnlockedVault,
} from "../session/vault-session.ts";
import {
  fromApiError,
  invalidInput,
  malformedSecretKey,
  sessionExpired,
  unexpected,
  untrustedServer,
  wrongCredentials,
  type AppResult,
} from "./errors.ts";

const MIN_PASSWORD_LENGTH = 12;

const toVerifiedSalt = (accountSaltBase64Url: string) => {
  const bytes = base64UrlToBytes(accountSaltBase64Url);
  if (!bytes.ok) return err(untrustedServer());

  const salt = toAccountSalt(bytes.value);
  if (!salt.ok) return err(untrustedServer());

  return ok(salt.value);
};

const toVerifiedArgon2 = (params: Argon2Params) => {
  const validated = validateArgon2Params(params);
  if (!validated.ok) return err(untrustedServer());

  return ok(validated.value);
};

const unwrapVaults = async (
  wrappingKey: WrappingKey,
  bundles: readonly VaultKeyBundle[],
): Promise<AppResult<readonly UnlockedVault[]>> => {
  const unlocked: UnlockedVault[] = [];

  for (const bundle of bundles) {
    const wrapped = toWrappedVaultKey(bundle.wrappedVaultKey);
    if (!wrapped.ok) return err(untrustedServer());

    const raw = await unwrapVaultKey(wrappingKey, wrapped.value, bundle.vaultId);
    if (!raw.ok) return err(wrongCredentials());

    try {
      const key = await importVaultKey(raw.value);
      if (!key.ok) return err(unexpected());

      unlocked.push({ vaultId: bundle.vaultId, key: key.value });
    } finally {
      wipeVaultKey(raw.value);
    }
  }

  return ok(unlocked);
};

const deriveKeys = async (
  masterPassword: string,
  secretKey: SecretKey,
  accountSaltBase64Url: string,
  argon2: Argon2Params,
): Promise<AppResult<AccountKeys>> => {
  const salt = toVerifiedSalt(accountSaltBase64Url);
  if (!salt.ok) return salt;

  const params = toVerifiedArgon2(argon2);
  if (!params.ok) return params;

  const passwordBytes = utf8ToBytes(masterPassword);
  if (!passwordBytes.ok) return err(invalidInput("รหัสผ่านหลัก"));

  try {
    const keys = await unlockAccount({
      masterPassword: passwordBytes.value,
      secretKey,
      accountSalt: salt.value,
      argon2: params.value,
    });
    if (!keys.ok) return err(unexpected());

    return ok(keys.value);
  } finally {
    wipe(passwordBytes.value);
  }
};

export type SignUpParams = {
  readonly email: string;
  readonly masterPassword: string;
  readonly nowMs: number;
};

export type EmergencyKit = {
  readonly email: string;
  readonly secretKey: string;
};

export const signUp = async (params: SignUpParams): Promise<AppResult<EmergencyKit>> => {
  if (params.masterPassword.length < MIN_PASSWORD_LENGTH) {
    return err(invalidInput(`รหัสผ่านหลัก (อย่างน้อย ${String(MIN_PASSWORD_LENGTH)} ตัวอักษร)`));
  }

  const secretKey = generateSecretKey();
  if (!secretKey.ok) return err(unexpected());

  const accountSalt = generateAccountSalt();
  if (!accountSalt.ok) return err(unexpected());

  const accountId = createUlid(params.nowMs);
  const vaultId = createUlid(params.nowMs);
  if (!accountId.ok || !vaultId.ok) return err(unexpected());

  const saltBase64Url = bytesToBase64Url(accountSalt.value);

  const keys = await deriveKeys(
    params.masterPassword,
    secretKey.value,
    saltBase64Url,
    ARGON2_PARAMS_V1,
  );
  if (!keys.ok) return keys;

  let handedOver = false;

  try {
    const vault = await createVault(keys.value.wrappingKey, {
      vaultId: vaultId.value,
      name: "ส่วนตัว",
      icon: "",
      color: "",
      now: new Date(params.nowMs).toISOString(),
    });
    if (!vault.ok) return err(unexpected());

    const created = await apiSignUp({
      email: params.email,
      accountId: accountId.value,
      accountSalt: saltBase64Url,
      argon2: ARGON2_PARAMS_V1,
      authKey: encodeAuthKey(keys.value.authKey),
      vault: vault.value.payload,
    });
    if (!created.ok) return err(fromApiError(created.error));

    const session = await apiLoginFinish({
      email: params.email,
      authKey: encodeAuthKey(keys.value.authKey),
    });
    if (!session.ok) return err(fromApiError(session.error));

    openSession({
      accountId: created.value.accountId,
      email: params.email,
      accountKeys: keys.value,
      vaults: [{ vaultId: vault.value.payload.vaultId, key: vault.value.key }],
      token: session.value.accessToken.token,
      tokenExpiresAtMs: Date.parse(session.value.accessToken.expiresAt),
      nowMs: params.nowMs,
    });
    handedOver = true;

    return ok({ email: params.email, secretKey: formatSecretKey(secretKey.value) });
  } finally {
    if (!handedOver) wipeAccountKeys(keys.value);
    wipe(secretKey.value);
  }
};

export type UnlockParams = {
  readonly email: string;
  readonly masterPassword: string;
  readonly secretKeyText: string;
  readonly nowMs: number;
};

export const unlock = async (params: UnlockParams): Promise<AppResult<void>> => {
  const secretKey = parseSecretKey(params.secretKeyText);
  if (!secretKey.ok) return err(malformedSecretKey());

  try {
    const challenge = await apiLoginBegin({ email: params.email });
    if (!challenge.ok) return err(fromApiError(challenge.error));

    const keys = await deriveKeys(
      params.masterPassword,
      secretKey.value,
      challenge.value.accountSalt,
      challenge.value.argon2,
    );
    if (!keys.ok) return keys;

    let handedOver = false;

    try {
      const session = await apiLoginFinish({
        email: params.email,
        authKey: encodeAuthKey(keys.value.authKey),
      });
      if (!session.ok) return err(fromApiError(session.error));

      const vaults = await unwrapVaults(keys.value.wrappingKey, session.value.vaults);
      if (!vaults.ok) return vaults;

      openSession({
        accountId: session.value.accountId,
        email: params.email,
        accountKeys: keys.value,
        vaults: vaults.value,
        token: session.value.accessToken.token,
        tokenExpiresAtMs: Date.parse(session.value.accessToken.expiresAt),
        nowMs: params.nowMs,
      });
      handedOver = true;

      return ok(undefined);
    } finally {
      if (!handedOver) wipeAccountKeys(keys.value);
    }
  } finally {
    wipe(secretKey.value);
  }
};

export const refreshToken = async (): Promise<AppResult<void>> => {
  const email = getSessionEmail();
  if (email === null) return err(wrongCredentials());

  const result = await withAuthKey(async (authKey) =>
    apiLoginFinish({ email, authKey: encodeAuthKey(authKey) }),
  );
  if (result === null) return err(wrongCredentials());
  if (!result.ok) {
    const mapped = fromApiError(result.error);
    if (mapped.kind !== "Offline") lockSession();
    return err(mapped);
  }

  replaceToken(result.value.accessToken.token, Date.parse(result.value.accessToken.expiresAt));
  return ok(undefined);
};

const getSessionAccountId = (): string | null => getSessionView().accountId;

export const ensureToken = async (nowMs: number): Promise<AppResult<string>> => {
  const current = getUsableToken(nowMs);
  if (current !== null) return ok(current);

  const refreshed = await refreshToken();
  if (!refreshed.ok) return refreshed;

  const renewed = getUsableToken(nowMs);
  if (renewed === null) return err(sessionExpired());

  return ok(renewed);
};

type RewrapResult = {
  readonly bundles: readonly VaultKeyBundle[];
  readonly vaults: readonly UnlockedVault[];
};

const rewrapAll = async (
  oldWrappingKey: WrappingKey,
  newWrappingKey: WrappingKey,
  wrappedVaults: readonly VaultKeyBundle[],
): Promise<AppResult<RewrapResult>> => {
  const bundles: VaultKeyBundle[] = [];
  const vaults: UnlockedVault[] = [];

  for (const bundle of wrappedVaults) {
    const wrapped = toWrappedVaultKey(bundle.wrappedVaultKey);
    if (!wrapped.ok) return err(untrustedServer());

    const raw = await unwrapVaultKey(oldWrappingKey, wrapped.value, bundle.vaultId);
    if (!raw.ok) return err(wrongCredentials());

    try {
      const rewrapped = await wrapVaultKey(newWrappingKey, raw.value, bundle.vaultId);
      if (!rewrapped.ok) return err(unexpected());

      const key = await importVaultKey(raw.value);
      if (!key.ok) return err(unexpected());

      bundles.push({ vaultId: bundle.vaultId, wrappedVaultKey: rewrapped.value });
      vaults.push({ vaultId: bundle.vaultId, key: key.value });
    } finally {
      wipeVaultKey(raw.value);
    }
  }

  return ok({ bundles, vaults });
};

export type ChangePasswordParams = {
  readonly currentMasterPassword: string;
  readonly secretKeyText: string;
  readonly newMasterPassword: string;
  readonly wrappedVaults: readonly VaultKeyBundle[];
  readonly nowMs: number;
};

export const changeMasterPassword = async (
  params: ChangePasswordParams,
): Promise<AppResult<void>> => {
  if (params.newMasterPassword.length < MIN_PASSWORD_LENGTH) {
    return err(invalidInput(`รหัสผ่านใหม่ (อย่างน้อย ${String(MIN_PASSWORD_LENGTH)} ตัวอักษร)`));
  }

  const email = getSessionEmail();
  if (email === null) return err(sessionExpired());

  const token = await ensureToken(params.nowMs);
  if (!token.ok) return token;

  const secretKey = parseSecretKey(params.secretKeyText);
  if (!secretKey.ok) return err(malformedSecretKey());

  try {
    const challenge = await apiLoginBegin({ email });
    if (!challenge.ok) return err(fromApiError(challenge.error));

    const currentKeys = await deriveKeys(
      params.currentMasterPassword,
      secretKey.value,
      challenge.value.accountSalt,
      challenge.value.argon2,
    );
    if (!currentKeys.ok) return currentKeys;

    try {
      const matches = await withAuthKey(async (sessionAuthKey) =>
        Promise.resolve(constantTimeEqual(currentKeys.value.authKey, sessionAuthKey)),
      );
      if (matches !== true) return err(wrongCredentials());

      const newSalt = generateAccountSalt();
      if (!newSalt.ok) return err(unexpected());

      const newSaltBase64Url = bytesToBase64Url(newSalt.value);

      const newKeys = await deriveKeys(
        params.newMasterPassword,
        secretKey.value,
        newSaltBase64Url,
        ARGON2_PARAMS_V1,
      );
      if (!newKeys.ok) return newKeys;

      let handedOver = false;

      try {
        const rewrapped = await withWrappingKey(async (oldWrappingKey) =>
          rewrapAll(oldWrappingKey, newKeys.value.wrappingKey, params.wrappedVaults),
        );
        if (rewrapped === null) return err(sessionExpired());
        if (!rewrapped.ok) return rewrapped;

        const changed = await apiChangeMasterPassword(
          {
            currentAuthKey: encodeAuthKey(currentKeys.value.authKey),
            newAccountSalt: newSaltBase64Url,
            newArgon2: ARGON2_PARAMS_V1,
            newAuthKey: encodeAuthKey(newKeys.value.authKey),
            rewrappedVaults: [...rewrapped.value.bundles],
          },
          token.value,
        );
        if (!changed.ok) return err(fromApiError(changed.error));

        openSession({
          accountId: getSessionAccountId() ?? "",
          email,
          accountKeys: newKeys.value,
          vaults: rewrapped.value.vaults,
          token: changed.value.accessToken.token,
          tokenExpiresAtMs: Date.parse(changed.value.accessToken.expiresAt),
          nowMs: params.nowMs,
        });
        handedOver = true;

        return ok(undefined);
      } finally {
        if (!handedOver) wipeAccountKeys(newKeys.value);
      }
    } finally {
      wipeAccountKeys(currentKeys.value);
    }
  } finally {
    wipe(secretKey.value);
  }
};

export type DeleteAccountParams = {
  readonly currentMasterPassword: string;
  readonly secretKeyText: string;
  readonly nowMs: number;
};

export const deleteMyAccount = async (
  params: DeleteAccountParams,
): Promise<AppResult<void>> => {
  const email = getSessionEmail();
  if (email === null) return err(sessionExpired());

  const token = await ensureToken(params.nowMs);
  if (!token.ok) return token;

  const secretKey = parseSecretKey(params.secretKeyText);
  if (!secretKey.ok) return err(malformedSecretKey());

  try {
    const challenge = await apiLoginBegin({ email });
    if (!challenge.ok) return err(fromApiError(challenge.error));

    const keys = await deriveKeys(
      params.currentMasterPassword,
      secretKey.value,
      challenge.value.accountSalt,
      challenge.value.argon2,
    );
    if (!keys.ok) return keys;

    try {
      const deleted = await apiDeleteAccount(
        { currentAuthKey: encodeAuthKey(keys.value.authKey) },
        token.value,
      );
      if (!deleted.ok) return err(fromApiError(deleted.error));

      lockSession();

      return ok(undefined);
    } finally {
      wipeAccountKeys(keys.value);
    }
  } finally {
    wipe(secretKey.value);
  }
};

export type RevokeSessionsParams = {
  readonly currentMasterPassword: string;
  readonly secretKeyText: string;
  readonly nowMs: number;
};

export const revokeOtherSessions = async (
  params: RevokeSessionsParams,
): Promise<AppResult<void>> => {
  const email = getSessionEmail();
  if (email === null) return err(sessionExpired());

  const token = await ensureToken(params.nowMs);
  if (!token.ok) return token;

  const secretKey = parseSecretKey(params.secretKeyText);
  if (!secretKey.ok) return err(malformedSecretKey());

  try {
    const challenge = await apiLoginBegin({ email });
    if (!challenge.ok) return err(fromApiError(challenge.error));

    const keys = await deriveKeys(
      params.currentMasterPassword,
      secretKey.value,
      challenge.value.accountSalt,
      challenge.value.argon2,
    );
    if (!keys.ok) return keys;

    try {
      const revoked = await apiRevokeSessions(
        { currentAuthKey: encodeAuthKey(keys.value.authKey) },
        token.value,
      );
      if (!revoked.ok) return err(fromApiError(revoked.error));

      replaceToken(
        revoked.value.accessToken.token,
        Date.parse(revoked.value.accessToken.expiresAt),
      );

      return ok(undefined);
    } finally {
      wipeAccountKeys(keys.value);
    }
  } finally {
    wipe(secretKey.value);
  }
};
