import type { VaultKeyBundle } from "@kunjae/contracts";
import type { DecryptedItem, ItemContent, VaultMetadata } from "@kunjae/domain";

type StoredVault = {
  readonly vaultId: string;
  readonly version: number;
  readonly metadata: VaultMetadata;
  readonly wrapped: VaultKeyBundle;
};

type StoreState = {
  vaults: Map<string, StoredVault>;
  items: Map<string, DecryptedItem>;
  broken: Set<string>;
  revision: number;
  syncing: boolean;
};

const emptyState = (): StoreState => ({
  vaults: new Map(),
  items: new Map(),
  broken: new Set(),
  revision: 0,
  syncing: false,
});

let state: StoreState = emptyState();

const listeners = new Set<() => void>();

const notify = (): void => {
  for (const listener of listeners) listener();
};

export const subscribeToStore = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export type ItemSummary = {
  readonly itemId: string;
  readonly vaultId: string;
  readonly type: ItemContent["type"];
  readonly title: string;
  readonly subtitle: string;
  readonly favorite: boolean;
  readonly hasTotp: boolean;
  readonly updatedAt: string;
};

export type VaultSummary = {
  readonly vaultId: string;
  readonly name: string;
  readonly icon: string;
  readonly color: string;
  readonly itemCount: number;
};

export type StoreView = {
  readonly vaults: readonly VaultSummary[];
  readonly items: readonly ItemSummary[];
  readonly brokenItemIds: readonly string[];
  readonly revision: number;
  readonly syncing: boolean;
};

const EMPTY_VIEW: StoreView = {
  vaults: [],
  items: [],
  brokenItemIds: [],
  revision: 0,
  syncing: false,
};

let cachedView: StoreView = EMPTY_VIEW;

const subtitleOf = (content: ItemContent): string => {
  switch (content.type) {
    case "login":
      return content.username;
    case "card":
      return content.cardholderName;
    case "secure-note":
      return "";
  }
};

const rebuildView = (): void => {
  const items = [...state.items.values()]
    .map((item) => ({
      itemId: item.itemId,
      vaultId: item.vaultId,
      type: item.content.type,
      title: item.content.title,
      subtitle: subtitleOf(item.content),
      favorite: item.content.favorite,
      hasTotp: item.content.type === "login" && item.content.totpSecret !== "",
      updatedAt: item.content.updatedAt,
    }))
    .sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return a.title.localeCompare(b.title, "th");
    });

  const countByVault = new Map<string, number>();
  for (const item of items) {
    countByVault.set(item.vaultId, (countByVault.get(item.vaultId) ?? 0) + 1);
  }

  cachedView = {
    vaults: [...state.vaults.values()].map((vault) => ({
      vaultId: vault.vaultId,
      name: vault.metadata.name,
      icon: vault.metadata.icon,
      color: vault.metadata.color,
      itemCount: countByVault.get(vault.vaultId) ?? 0,
    })),
    items,
    brokenItemIds: [...state.broken],
    revision: state.revision,
    syncing: state.syncing,
  };
};

export const getStoreView = (): StoreView => cachedView;

export const getItemContent = (itemId: string): ItemContent | null =>
  state.items.get(itemId)?.content ?? null;

export const getItemRef = (
  itemId: string,
): { readonly itemId: string; readonly vaultId: string; readonly version: number } | null => {
  const item = state.items.get(itemId);
  if (item === undefined) return null;

  return { itemId: item.itemId, vaultId: item.vaultId, version: item.version };
};

export const getAllItemsForExport = (): readonly DecryptedItem[] =>
  [...state.items.values()];

export const getVaultNamesForExport = (): ReadonlyMap<string, string> =>
  new Map([...state.vaults.values()].map((vault) => [vault.vaultId, vault.metadata.name]));

export const getWrappedVaults = (): readonly VaultKeyBundle[] =>
  [...state.vaults.values()].map((vault) => vault.wrapped);

export const getDefaultVaultId = (): string | null =>
  [...state.vaults.keys()][0] ?? null;

export const setSyncing = (syncing: boolean): void => {
  state.syncing = syncing;
  rebuildView();
  notify();
};

export const upsertVault = (vault: StoredVault): void => {
  state.vaults.set(vault.vaultId, vault);
  rebuildView();
  notify();
};

export const upsertItem = (item: DecryptedItem): void => {
  state.items.set(item.itemId, item);
  state.broken.delete(item.itemId);
  rebuildView();
  notify();
};

export const removeItem = (itemId: string): void => {
  state.items.delete(itemId);
  state.broken.delete(itemId);
  rebuildView();
  notify();
};

export const markBroken = (itemId: string): void => {
  state.broken.add(itemId);
  state.items.delete(itemId);
  rebuildView();
  notify();
};

export const setRevision = (revision: number): void => {
  state.revision = revision;
  rebuildView();
  notify();
};

export const getRevision = (): number => state.revision;

export const clearStore = (): void => {
  state = emptyState();
  cachedView = EMPTY_VIEW;
  notify();
};
