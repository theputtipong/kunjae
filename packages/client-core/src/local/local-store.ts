import {
  base64UrlToBytes,
  deriveLocalWrappingKey,
  err,
  ok,
  toAccountSalt,
  utf8ToBytes,
  validateArgon2Params,
  wipe,
  type Argon2Params,
  type WrappingKey,
} from "@kunjae/core-crypto";
import type { ItemChange, ItemRecord, VaultRecord } from "@kunjae/contracts";
import {
  createVault as createVaultContent,
  openItem,
  openVault,
  type DecryptedItem,
  type DomainResult,
  type OpenedVault,
} from "@kunjae/domain";

import { createUlid } from "../lib/ulid.ts";
import {
  addUnlockedVault,
  isLocalSession,
  lockSession,
  withVaultKey,
  withWrappingKey,
} from "../session/vault-session.ts";
import {
  clearStore,
  getAllItemsForExport,
  markBroken,
  removeItem,
  upsertItem,
  upsertVault,
} from "../store/vault-store.ts";
import {
  conflict,
  invalidInput,
  localStorageFailed,
  localVaultCorrupt,
  localVaultMissing,
  sessionExpired,
  unexpected,
  wrongDevicePassword,
  type AppResult,
} from "../services/errors.ts";
import {
  LOCAL_LIMITS,
  LocalRecordSchema,
  type LocalItemEntry,
  type LocalRecord,
  type LocalVaultEntry,
} from "./local-record.ts";
import { getLocalPersistence } from "./persistence.ts";

let openedSalt: string | null = null;

let queue: Promise<unknown> = Promise.resolve();

export const serializeLocal = <T>(task: () => Promise<T>): Promise<T> => {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
};

export const setOpenedSalt = (salt: string | null): void => {
  openedSalt = salt;
};

export const loadLocalRecord = async (): Promise<AppResult<LocalRecord | null>> => {
  const persistence = getLocalPersistence();
  if (persistence === null) return err(localStorageFailed());

  let raw: unknown;
  try {
    raw = await persistence.load();
  } catch {
    return err(localStorageFailed());
  }

  if (raw === null || raw === undefined) return ok(null);

  const parsed = LocalRecordSchema.safeParse(raw);
  if (!parsed.success) return err(localVaultCorrupt());

  return ok(parsed.data);
};

export const saveLocalRecord = async (record: LocalRecord): Promise<AppResult<void>> => {
  const persistence = getLocalPersistence();
  if (persistence === null) return err(localStorageFailed());

  try {
    await persistence.save(record);
    return ok(undefined);
  } catch {
    return err(localStorageFailed());
  }
};

export const clearLocalRecord = async (): Promise<AppResult<void>> => {
  const persistence = getLocalPersistence();
  if (persistence === null) return err(localStorageFailed());

  try {
    await persistence.clear();
    return ok(undefined);
  } catch {
    return err(localStorageFailed());
  }
};

export const deriveLocalKey = async (
  masterPassword: string,
  saltBase64Url: string,
  argon2: Argon2Params,
): Promise<AppResult<WrappingKey>> => {
  const saltBytes = base64UrlToBytes(saltBase64Url);
  if (!saltBytes.ok) return err(localVaultCorrupt());

  const salt = toAccountSalt(saltBytes.value);
  if (!salt.ok) return err(localVaultCorrupt());

  const params = validateArgon2Params(argon2);
  if (!params.ok) return err(localVaultCorrupt());

  const passwordBytes = utf8ToBytes(masterPassword);
  if (!passwordBytes.ok) return err(invalidInput("deviceMasterPassword"));

  try {
    const key = await deriveLocalWrappingKey({
      masterPassword: passwordBytes.value,
      salt: salt.value,
      argon2: params.value,
    });
    if (!key.ok) return err(unexpected());

    return ok(key.value);
  } finally {
    wipe(passwordBytes.value);
  }
};

export const toVaultRecord = (entry: LocalVaultEntry, updatedAt: string): VaultRecord => ({
  vaultId: entry.vaultId,
  version: entry.version,
  updatedAt,
  wrappedVaultKey: entry.wrappedVaultKey,
  metadata: entry.encryptedMetadata,
});

export const toItemRecord = (entry: LocalItemEntry, updatedAt: string): ItemRecord => ({
  itemId: entry.itemId,
  vaultId: entry.vaultId,
  version: entry.version,
  updatedAt,
  deleted: false,
  envelope: entry.envelope,
});

export const openLocalVaults = async (
  wrappingKey: WrappingKey,
  record: LocalRecord,
): Promise<AppResult<readonly OpenedVault[]>> => {
  const opened: OpenedVault[] = [];

  for (const entry of record.vaults) {
    const vault = await openVault(wrappingKey, toVaultRecord(entry, record.createdAt));
    if (!vault.ok) return err(wrongDevicePassword());
    opened.push(vault.value);
  }

  return ok(opened);
};

export const openLocalItems = async (
  vaults: readonly OpenedVault[],
  record: LocalRecord,
): Promise<readonly { readonly itemId: string; readonly result: DomainResult<DecryptedItem> | null }[]> => {
  const keys = new Map(vaults.map((vault) => [vault.vaultId, vault.key]));

  return Promise.all(
    record.items.map(async (entry) => {
      const key = keys.get(entry.vaultId);
      return {
        itemId: entry.itemId,
        result: key === undefined ? null : await openItem(key, toItemRecord(entry, record.createdAt)),
      };
    }),
  );
};

const absorbVaults = (record: LocalRecord, vaults: readonly OpenedVault[]): void => {
  const entries = new Map(record.vaults.map((entry) => [entry.vaultId, entry]));

  for (const vault of vaults) {
    const entry = entries.get(vault.vaultId);
    if (entry === undefined) continue;

    upsertVault({
      vaultId: vault.vaultId,
      version: vault.version,
      metadata: vault.metadata,
      wrapped: { vaultId: vault.vaultId, wrappedVaultKey: entry.wrappedVaultKey },
    });
  }
};

export const fillStoreFromRecord = async (
  record: LocalRecord,
  vaults: readonly OpenedVault[],
): Promise<void> => {
  clearStore();
  absorbVaults(record, vaults);

  for (const { itemId, result } of await openLocalItems(vaults, record)) {
    if (result?.ok === true) upsertItem(result.value);
    else markBroken(itemId);
  }
};

const loadForSession = async (): Promise<AppResult<LocalRecord>> => {
  if (!isLocalSession()) return err(sessionExpired());

  const loaded = await loadLocalRecord();
  if (!loaded.ok) return loaded;

  if (loaded.value === null) {
    lockSession();
    return err(localVaultMissing());
  }

  if (loaded.value.salt !== openedSalt) {
    lockSession();
    return err(sessionExpired());
  }

  return ok(loaded.value);
};

const reloadUnserialized = async (): Promise<AppResult<void>> => {
  const loaded = await loadForSession();
  if (!loaded.ok) return loaded;
  const record = loaded.value;

  const vaults: OpenedVault[] = [];
  for (const entry of record.vaults) {
    const opened = await withWrappingKey(async (wrappingKey) =>
      openVault(wrappingKey, toVaultRecord(entry, record.createdAt)),
    );
    if (opened === null) return err(sessionExpired());
    if (!opened.ok) return err(localVaultCorrupt());

    addUnlockedVault({ vaultId: opened.value.vaultId, key: opened.value.key });
    vaults.push(opened.value);
  }

  absorbVaults(record, vaults);

  const present = new Set(record.items.map((entry) => entry.itemId));
  for (const item of getAllItemsForExport()) {
    if (!present.has(item.itemId)) removeItem(item.itemId);
  }

  for (const entry of record.items) {
    const opened = await withVaultKey(entry.vaultId, async (key) =>
      openItem(key, toItemRecord(entry, record.createdAt)),
    );
    if (opened?.ok === true) upsertItem(opened.value);
    else markBroken(entry.itemId);
  }

  return ok(undefined);
};

export const reloadLocalVault = (): Promise<AppResult<void>> => serializeLocal(reloadUnserialized);

export const applyLocalChange = (change: ItemChange): Promise<AppResult<void>> =>
  serializeLocal(async () => {
    const loaded = await loadForSession();
    if (!loaded.ok) return loaded;
    const record = loaded.value;

    if (!record.vaults.some((vault) => vault.vaultId === change.vaultId)) return err(unexpected());

    const existing = record.items.find((item) => item.itemId === change.itemId);
    if ((existing?.version ?? 0) !== change.baseVersion) {
      await reloadUnserialized();
      return err(conflict());
    }

    const items = record.items.filter((item) => item.itemId !== change.itemId);

    if (!change.deleted) {
      if (items.length >= LOCAL_LIMITS.items) return err(unexpected());
      items.push({
        itemId: change.itemId,
        vaultId: change.vaultId,
        version: change.version,
        envelope: change.envelope,
      });
    }

    return saveLocalRecord({ ...record, items });
  });

export const createLocalVaultEntry = (params: {
  readonly name: string;
  readonly nowMs: number;
}): Promise<AppResult<string>> =>
  serializeLocal(async () => {
    const loaded = await loadForSession();
    if (!loaded.ok) return loaded;
    const record = loaded.value;

    if (record.vaults.length >= LOCAL_LIMITS.vaults) return err(unexpected());

    const vaultId = createUlid(params.nowMs);
    if (!vaultId.ok) return err(unexpected());

    const now = new Date(params.nowMs).toISOString();

    const created = await withWrappingKey(async (wrappingKey) =>
      createVaultContent(wrappingKey, {
        vaultId: vaultId.value,
        name: params.name,
        icon: "",
        color: "",
        now,
      }),
    );
    if (created === null) return err(sessionExpired());
    if (!created.ok) return err(unexpected());

    const saved = await saveLocalRecord({
      ...record,
      vaults: [
        ...record.vaults,
        {
          vaultId: vaultId.value,
          version: 1,
          wrappedVaultKey: created.value.payload.wrappedVaultKey,
          encryptedMetadata: created.value.payload.metadata,
        },
      ],
    });
    if (!saved.ok) return saved;

    addUnlockedVault({ vaultId: vaultId.value, key: created.value.key });

    upsertVault({
      vaultId: vaultId.value,
      version: 1,
      metadata: { name: params.name, icon: "", color: "", createdAt: now, updatedAt: now },
      wrapped: { vaultId: vaultId.value, wrappedVaultKey: created.value.payload.wrappedVaultKey },
    });

    return ok(vaultId.value);
  });
