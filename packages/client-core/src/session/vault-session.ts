import { wipe, wipeAccountKeys, type AccountKeys, type WrappingKey } from "@kunjae/core-crypto";

export type UnlockedVault = {
  readonly vaultId: string;
  readonly key: CryptoKey;
};

export type SessionMode = "account" | "local";

type SessionState = {
  readonly mode: SessionMode;
  readonly accountId: string | null;
  readonly email: string | null;
  readonly accountKeys: AccountKeys | null;
  localWrappingKey: WrappingKey | null;
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
  readonly mode: SessionMode | null;
  readonly accountId: string | null;
  readonly email: string | null;
  readonly vaultIds: readonly string[];
};

const LOCKED_VIEW: SessionView = {
  status: "locked",
  mode: null,
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
          mode: session.mode,
          accountId: session.accountId,
          email: session.email,
          vaultIds: [...session.vaults.keys()],
        };
};

export const getSessionView = (): SessionView => cachedView;

export const getSessionMode = (): SessionMode | null => session?.mode ?? null;

export const isLocalSession = (): boolean => session?.mode === "local";

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
    mode: "account",
    accountId: params.accountId,
    email: params.email,
    accountKeys: params.accountKeys,
    localWrappingKey: null,
    vaults: new Map(params.vaults.map((vault) => [vault.vaultId, vault])),
    token: params.token,
    tokenExpiresAtMs: params.tokenExpiresAtMs,
    lastActivityMs: params.nowMs,
  };

  rebuildView();
  notify();
};

export type OpenLocalSessionParams = {
  readonly wrappingKey: WrappingKey;
  readonly vaults: readonly UnlockedVault[];
  readonly nowMs: number;
};

export const openLocalSession = (params: OpenLocalSessionParams): void => {
  lockSession();

  session = {
    mode: "local",
    accountId: null,
    email: null,
    accountKeys: null,
    localWrappingKey: params.wrappingKey,
    vaults: new Map(params.vaults.map((vault) => [vault.vaultId, vault])),
    token: "",
    tokenExpiresAtMs: 0,
    lastActivityMs: params.nowMs,
  };

  rebuildView();
  notify();
};

export const replaceLocalWrappingKey = (wrappingKey: WrappingKey): boolean => {
  if (session?.mode !== "local" || session.localWrappingKey === null) return false;

  wipe(session.localWrappingKey);
  session.localWrappingKey = wrappingKey;
  return true;
};

export const lockSession = (): void => {
  if (session === null) return;

  if (session.accountKeys !== null) wipeAccountKeys(session.accountKeys);
  if (session.localWrappingKey !== null) wipe(session.localWrappingKey);
  session.localWrappingKey = null;

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
  if (session === null) return null;

  const key = session.mode === "local" ? session.localWrappingKey : session.accountKeys?.wrappingKey;
  if (key === null || key === undefined) return null;

  return borrow(key);
};

export const addUnlockedVault = (vault: UnlockedVault): void => {
  if (session === null) return;

  session.vaults.set(vault.vaultId, vault);
  rebuildView();
  notify();
};

const TOKEN_EXPIRY_MARGIN_MS = 30_000;

export const getUsableToken = (nowMs: number): string | null => {
  if (session?.mode !== "account") return null;
  if (session.tokenExpiresAtMs - TOKEN_EXPIRY_MARGIN_MS <= nowMs) return null;

  return session.token;
};

export const needsTokenRefresh = (nowMs: number): boolean =>
  session?.mode === "account" && getUsableToken(nowMs) === null;

export const replaceToken = (token: string, expiresAtMs: number): void => {
  if (session?.mode !== "account") return;

  session.token = token;
  session.tokenExpiresAtMs = expiresAtMs;
};

export const withAuthKey = async <T>(
  borrow: (authKey: AccountKeys["authKey"]) => Promise<T>,
): Promise<T | null> => {
  const keys = session?.accountKeys;
  if (keys === undefined || keys === null) return null;

  return borrow(keys.authKey);
};

export const markActivity = (nowMs: number): void => {
  if (session === null) return;
  session.lastActivityMs = nowMs;
};

export const idleMs = (nowMs: number): number | null =>
  session === null ? null : nowMs - session.lastActivityMs;

export const getSessionEmail = (): string | null => session?.email ?? null;
