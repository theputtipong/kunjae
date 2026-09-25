import { wipeAccountKeys, type AccountKeys, type WrappingKey } from "@kunjae/core-crypto";

export type UnlockedVault = {
  readonly vaultId: string;
  readonly key: CryptoKey;
};

type SessionState = {
  readonly accountId: string;
  readonly email: string;
  readonly accountKeys: AccountKeys;
  readonly vaults: Map<string, UnlockedVault>;
  token: string;
  tokenExpiresAtMs: number;
  lastActivityMs: number;
};

let session: SessionState | null = null;

const listeners = new Set<() => void>();

const notify = (): void => {
  for (const listener of listeners) listener();
};

export const subscribeToSession = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export type SessionView = {
  readonly status: "locked" | "unlocked";
  readonly accountId: string | null;
  readonly email: string | null;
  readonly vaultIds: readonly string[];
};

const LOCKED_VIEW: SessionView = {
  status: "locked",
  accountId: null,
  email: null,
  vaultIds: [],
};

let cachedView: SessionView = LOCKED_VIEW;

const rebuildView = (): void => {
  cachedView =
    session === null
      ? LOCKED_VIEW
      : {
          status: "unlocked",
          accountId: session.accountId,
          email: session.email,
          vaultIds: [...session.vaults.keys()],
        };
};

export const getSessionView = (): SessionView => cachedView;

export type OpenSessionParams = {
  readonly accountId: string;
  readonly email: string;
  readonly accountKeys: AccountKeys;
  readonly vaults: readonly UnlockedVault[];
  readonly token: string;
  readonly tokenExpiresAtMs: number;
  readonly nowMs: number;
};

export const openSession = (params: OpenSessionParams): void => {
  lockSession();

  session = {
    accountId: params.accountId,
    email: params.email,
    accountKeys: params.accountKeys,
    vaults: new Map(params.vaults.map((vault) => [vault.vaultId, vault])),
    token: params.token,
    tokenExpiresAtMs: params.tokenExpiresAtMs,
    lastActivityMs: params.nowMs,
  };

  rebuildView();
  notify();
};

export const lockSession = (): void => {
  if (session === null) return;

  wipeAccountKeys(session.accountKeys);

  session.token = "";

  session.vaults.clear();

  session = null;
  rebuildView();
  notify();
};

export const withVaultKey = async <T>(
  vaultId: string,
  borrow: (key: CryptoKey) => Promise<T>,
): Promise<T | null> => {
  const vault = session?.vaults.get(vaultId);
  if (vault === undefined) return null;

  return borrow(vault.key);
};

export const withWrappingKey = async <T>(
  borrow: (key: WrappingKey) => Promise<T>,
): Promise<T | null> => {
  const keys = session?.accountKeys;
  if (keys === undefined) return null;

  return borrow(keys.wrappingKey);
};

export const addUnlockedVault = (vault: UnlockedVault): void => {
  if (session === null) return;

  session.vaults.set(vault.vaultId, vault);
  rebuildView();
  notify();
};

const TOKEN_EXPIRY_MARGIN_MS = 30_000;

export const getUsableToken = (nowMs: number): string | null => {
  if (session === null) return null;
  if (session.tokenExpiresAtMs - TOKEN_EXPIRY_MARGIN_MS <= nowMs) return null;

  return session.token;
};

export const needsTokenRefresh = (nowMs: number): boolean =>
  session !== null && getUsableToken(nowMs) === null;

export const replaceToken = (token: string, expiresAtMs: number): void => {
  if (session === null) return;

  session.token = token;
  session.tokenExpiresAtMs = expiresAtMs;
};

export const withAuthKey = async <T>(
  borrow: (authKey: AccountKeys["authKey"]) => Promise<T>,
): Promise<T | null> => {
  const keys = session?.accountKeys;
  if (keys === undefined) return null;

  return borrow(keys.authKey);
};

export const markActivity = (nowMs: number): void => {
  if (session === null) return;
  session.lastActivityMs = nowMs;
};

export const idleMs = (nowMs: number): number | null =>
  session === null ? null : nowMs - session.lastActivityMs;

export const getSessionEmail = (): string | null => session?.email ?? null;
