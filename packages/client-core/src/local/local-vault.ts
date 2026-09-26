import {
  ARGON2_PARAMS_V1,
  bytesToBase64Url,
  err,
  generateAccountSalt,
  ok,
  toWrappedVaultKey,
  unwrapVaultKey,
  wipe,
  wipeVaultKey,
  wrapVaultKey,
  type WrappingKey,
} from "@kunjae/core-crypto";
import { createVault as createVaultContent, type DecryptedItem } from "@kunjae/domain";

import { createUlid } from "../lib/ulid.ts";
import {
  getSessionMode,
  isLocalSession,
  lockSession,
  openLocalSession,
  replaceLocalWrappingKey,
} from "../session/vault-session.ts";
import { clearStore, getDefaultVaultId, upsertVault } from "../store/vault-store.ts";
import {
  accountRequired,
  invalidInput,
  localVaultCorrupt,
  localVaultExists,
  localVaultMissing,
  sessionExpired,
  unexpected,
  wrongDevicePassword,
  type AppResult,
  type MessageLang,
} from "../services/errors.ts";
import { saveItem } from "../services/sync.ts";
import { LOCAL_RECORD_FORMAT, type LocalRecord, type LocalVaultEntry } from "./local-record.ts";
import {
  clearLocalRecord,
  deriveLocalKey,
  fillStoreFromRecord,
  loadLocalRecord,
  openLocalItems,
  openLocalVaults,
  saveLocalRecord,
  serializeLocal,
  setOpenedSalt,
} from "./local-store.ts";

export const MIN_LOCAL_PASSWORD_LENGTH = 12;

export const hasLocalVault = async (): Promise<boolean> => {
  const loaded = await loadLocalRecord();
  if (loaded.ok) return loaded.value !== null;
  return loaded.error.kind === "LocalVaultCorrupt";
};

export type LocalVaultSummary = {
  readonly itemCount: number;
  readonly vaultCount: number;
  readonly createdAt: string;
};

export const getLocalVaultSummary = async (): Promise<AppResult<LocalVaultSummary | null>> => {
  const loaded = await loadLocalRecord();
  if (!loaded.ok) return loaded;
  if (loaded.value === null) return ok(null);

  return ok({
    itemCount: loaded.value.items.length,
    vaultCount: loaded.value.vaults.length,
    createdAt: loaded.value.createdAt,
  });
};

export type CreateLocalVaultParams = {
  readonly masterPassword: string;
  readonly lang?: MessageLang;
  readonly nowMs?: number;
};

export const createLocalVault = (params: CreateLocalVaultParams): Promise<AppResult<void>> =>
  serializeLocal(async () => {
    if (params.masterPassword.length < MIN_LOCAL_PASSWORD_LENGTH) {
      return err(invalidInput("deviceMasterPassword", MIN_LOCAL_PASSWORD_LENGTH));
    }

    const existing = await loadLocalRecord();
    if (!existing.ok) return existing.error.kind === "LocalVaultCorrupt" ? err(localVaultExists()) : existing;
    if (existing.value !== null) return err(localVaultExists());

    const nowMs = params.nowMs ?? Date.now();
    const now = new Date(nowMs).toISOString();

    const salt = generateAccountSalt();
    if (!salt.ok) return err(unexpected());
    const saltBase64Url = bytesToBase64Url(salt.value);

    const vaultId = createUlid(nowMs);
    if (!vaultId.ok) return err(unexpected());

    const wrappingKey = await deriveLocalKey(params.masterPassword, saltBase64Url, ARGON2_PARAMS_V1);
    if (!wrappingKey.ok) return wrappingKey;

    let handedOver = false;

    try {
      const name = params.lang === "th" ? "ส่วนตัว" : "Personal";

      const vault = await createVaultContent(wrappingKey.value, {
        vaultId: vaultId.value,
        name,
        icon: "",
        color: "",
        now,
      });
      if (!vault.ok) return err(unexpected());

      const record: LocalRecord = {
        format: LOCAL_RECORD_FORMAT,
        salt: saltBase64Url,
        argon2: { ...ARGON2_PARAMS_V1 },
        createdAt: now,
        vaults: [
          {
            vaultId: vaultId.value,
            version: 1,
            wrappedVaultKey: vault.value.payload.wrappedVaultKey,
            encryptedMetadata: vault.value.payload.metadata,
          },
        ],
        items: [],
      };

      const saved = await saveLocalRecord(record);
      if (!saved.ok) return saved;

      openLocalSession({
        wrappingKey: wrappingKey.value,
        vaults: [{ vaultId: vaultId.value, key: vault.value.key }],
        nowMs,
      });
      handedOver = true;
      setOpenedSalt(saltBase64Url);

      clearStore();
      upsertVault({
        vaultId: vaultId.value,
        version: 1,
        metadata: { name, icon: "", color: "", createdAt: now, updatedAt: now },
        wrapped: { vaultId: vaultId.value, wrappedVaultKey: vault.value.payload.wrappedVaultKey },
      });

      return ok(undefined);
    } finally {
      if (!handedOver) wipe(wrappingKey.value);
    }
  });

export type UnlockLocalParams = {
  readonly masterPassword: string;
  readonly nowMs?: number;
};

export const unlockLocal = (params: UnlockLocalParams): Promise<AppResult<void>> =>
  serializeLocal(async () => {
    if (params.masterPassword.length === 0) return err(wrongDevicePassword());

    const loaded = await loadLocalRecord();
    if (!loaded.ok) return loaded;
    if (loaded.value === null) return err(localVaultMissing());
    const record = loaded.value;

    const wrappingKey = await deriveLocalKey(params.masterPassword, record.salt, record.argon2);
    if (!wrappingKey.ok) return wrappingKey;

    let handedOver = false;

    try {
      const vaults = await openLocalVaults(wrappingKey.value, record);
      if (!vaults.ok) return vaults;

      openLocalSession({
        wrappingKey: wrappingKey.value,
        vaults: vaults.value.map((vault) => ({ vaultId: vault.vaultId, key: vault.key })),
        nowMs: params.nowMs ?? Date.now(),
      });
      handedOver = true;
      setOpenedSalt(record.salt);

      await fillStoreFromRecord(record, vaults.value);

      return ok(undefined);
    } finally {
      if (!handedOver) wipe(wrappingKey.value);
    }
  });

const rewrapEntries = async (
  currentKey: WrappingKey,
  nextKey: WrappingKey,
  entries: readonly LocalVaultEntry[],
): Promise<AppResult<readonly LocalVaultEntry[]>> => {
  const rewrapped: LocalVaultEntry[] = [];

  for (const entry of entries) {
    const wrapped = toWrappedVaultKey(entry.wrappedVaultKey);
    if (!wrapped.ok) return err(localVaultCorrupt());

    const raw = await unwrapVaultKey(currentKey, wrapped.value, entry.vaultId);
    if (!raw.ok) return err(wrongDevicePassword());

    try {
      const next = await wrapVaultKey(nextKey, raw.value, entry.vaultId);
      if (!next.ok) return err(unexpected());

      rewrapped.push({ ...entry, wrappedVaultKey: next.value });
    } finally {
      wipeVaultKey(raw.value);
    }
  }

  return ok(rewrapped);
};

export type ChangeLocalPasswordParams = {
  readonly current: string;
  readonly next: string;
};

export const changeLocalPassword = (params: ChangeLocalPasswordParams): Promise<AppResult<void>> =>
  serializeLocal(async () => {
    if (!isLocalSession()) return err(sessionExpired());

    if (params.next.length < MIN_LOCAL_PASSWORD_LENGTH) {
      return err(invalidInput("newDeviceMasterPassword", MIN_LOCAL_PASSWORD_LENGTH));
    }
    if (params.current.length === 0) return err(wrongDevicePassword());

    const loaded = await loadLocalRecord();
    if (!loaded.ok) return loaded;
    if (loaded.value === null) return err(localVaultMissing());
    const record = loaded.value;

    const currentKey = await deriveLocalKey(params.current, record.salt, record.argon2);
    if (!currentKey.ok) return currentKey;

    try {
      const salt = generateAccountSalt();
      if (!salt.ok) return err(unexpected());
      const saltBase64Url = bytesToBase64Url(salt.value);

      const nextKey = await deriveLocalKey(params.next, saltBase64Url, ARGON2_PARAMS_V1);
      if (!nextKey.ok) return nextKey;

      let handedOver = false;

      try {
        const vaults = await rewrapEntries(currentKey.value, nextKey.value, record.vaults);
        if (!vaults.ok) return vaults;

        const saved = await saveLocalRecord({
          ...record,
          salt: saltBase64Url,
          argon2: { ...ARGON2_PARAMS_V1 },
          vaults: [...vaults.value],
        });
        if (!saved.ok) return saved;

        setOpenedSalt(saltBase64Url);
        if (!replaceLocalWrappingKey(nextKey.value)) return err(sessionExpired());
        handedOver = true;

        return ok(undefined);
      } finally {
        if (!handedOver) wipe(nextKey.value);
      }
    } finally {
      wipe(currentKey.value);
    }
  });

export const deleteLocalVault = (): Promise<AppResult<void>> =>
  serializeLocal(async () => {
    const cleared = await clearLocalRecord();
    if (!cleared.ok) return cleared;

    setOpenedSalt(null);

    if (isLocalSession()) {
      lockSession();
      clearStore();
    }

    return ok(undefined);
  });

export type MigrateLocalParams = {
  readonly devicePassword: string;
  readonly nowMs: number;
  readonly targetVaultId?: string;
};

export type MigrateLocalResult = {
  readonly moved: number;
  readonly failed: number;
  readonly cleared: boolean;
};

export const migrateLocalToAccount = (params: MigrateLocalParams): Promise<AppResult<MigrateLocalResult>> =>
  serializeLocal(async () => {
    if (getSessionMode() !== "account") return err(accountRequired());

    const targetVaultId = params.targetVaultId ?? getDefaultVaultId();
    if (targetVaultId === null) return err(unexpected());

    if (params.devicePassword.length === 0) return err(wrongDevicePassword());

    const loaded = await loadLocalRecord();
    if (!loaded.ok) return loaded;
    if (loaded.value === null) return err(localVaultMissing());
    const record = loaded.value;

    const wrappingKey = await deriveLocalKey(params.devicePassword, record.salt, record.argon2);
    if (!wrappingKey.ok) return wrappingKey;

    const vaults = await openLocalVaults(wrappingKey.value, record).finally(() => {
      wipe(wrappingKey.value);
    });
    if (!vaults.ok) return vaults;

    const opened = await openLocalItems(vaults.value, record);

    const items: DecryptedItem[] = [];
    let failed = 0;
    for (const { result } of opened) {
      if (result?.ok === true) items.push(result.value);
      else failed += 1;
    }

    const movedIds = new Set<string>();

    for (const [index, item] of items.entries()) {
      const newId = createUlid(params.nowMs + index);
      if (!newId.ok) {
        failed += 1;
        continue;
      }

      const saved = await saveItem({
        itemId: newId.value,
        vaultId: targetVaultId,
        content: item.content,
        baseVersion: 0,
        nowMs: params.nowMs,
      });

      if (saved.ok) movedIds.add(item.itemId);
      else failed += 1;
    }

    if (failed === 0) {
      const cleared = await clearLocalRecord();
      return ok({ moved: movedIds.size, failed, cleared: cleared.ok });
    }

    if (movedIds.size > 0) {
      await saveLocalRecord({
        ...record,
        items: record.items.filter((entry) => !movedIds.has(entry.itemId)),
      });
    }

    return ok({ moved: movedIds.size, failed, cleared: false });
  });
