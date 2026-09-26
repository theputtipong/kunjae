import { useSyncExternalStore } from "react";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "kunjae.theme";

const THEME_COLORS = { light: "#FFF8F0", dark: "#17130B" } as const;

const NEXT_MODE: Readonly<Record<ThemeMode, ThemeMode>> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "system" || value === "light" || value === "dark";

const readStoredMode = (): ThemeMode => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isThemeMode(stored) ? stored : "system";
  } catch {
    return "system";
  }
};

const persistMode = (mode: ThemeMode): void => {
  try {
    if (mode === "system") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    return;
  }
};

let current: ThemeMode = readStoredMode();

const listeners = new Set<() => void>();

const applyTheme = (): void => {
  const root = document.documentElement;
  if (current === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", current);

  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme = meta.media.includes("dark") ? "dark" : "light";
    meta.content = THEME_COLORS[current === "system" ? scheme : current];
  }
};

export const initTheme = (): void => {
  applyTheme();
};

export const getThemeMode = (): ThemeMode => current;

export const nextThemeMode = (mode: ThemeMode): ThemeMode => NEXT_MODE[mode];

export const setThemeMode = (mode: ThemeMode): void => {
  current = mode;
  persistMode(mode);
  applyTheme();
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useThemeMode = (): ThemeMode => useSyncExternalStore(subscribe, getThemeMode, getThemeMode);
