import { useSyncExternalStore } from "react";

import { hasLocalVault } from "@kunjae/client-core";

export type LocalPresence = "unknown" | "none" | "present";

let presence: LocalPresence = "unknown";
let migrationDismissed = false;

const listeners = new Set<() => void>();

const notify = (): void => {
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const refreshLocalPresence = async (): Promise<LocalPresence> => {
  presence = (await hasLocalVault()) ? "present" : "none";
  notify();
  return presence;
};

export const getLocalPresence = (): LocalPresence => presence;

export const useLocalPresence = (): LocalPresence =>
  useSyncExternalStore(subscribe, getLocalPresence, getLocalPresence);

const getMigrationDismissed = (): boolean => migrationDismissed;

export const dismissMigration = (): void => {
  migrationDismissed = true;
  notify();
};

export const useMigrationDismissed = (): boolean =>
  useSyncExternalStore(subscribe, getMigrationDismissed, getMigrationDismissed);
