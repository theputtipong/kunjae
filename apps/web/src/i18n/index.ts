import { useSyncExternalStore } from "react";

import { en, type Dictionary } from "./en.ts";
import { th } from "./th.ts";

export type { Dictionary } from "./en.ts";

export type Lang = "en" | "th";

export const DEFAULT_LANG: Lang = "en";

const STORAGE_KEY = "kunjae.lang";

const DICTIONARIES: Readonly<Record<Lang, Dictionary>> = { en, th };

const isLang = (value: unknown): value is Lang => value === "en" || value === "th";

const readStoredLang = (): Lang | null => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLang(stored) ? stored : null;
  } catch {
    return null;
  }
};

const detectBrowserLang = (): Lang => {
  try {
    const tags = navigator.languages.length > 0 ? navigator.languages : [navigator.language];
    return tags.some((tag) => tag.toLowerCase().startsWith("th")) ? "th" : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
};

let current: Lang = readStoredLang() ?? detectBrowserLang();

const listeners = new Set<() => void>();

const applyLang = (): void => {
  document.documentElement.lang = current;
};

export const initLang = (): void => {
  applyLang();
};

export const getLang = (): Lang => current;

const persistLang = (lang: Lang): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    return;
  }
};

export const setLang = (lang: Lang): void => {
  current = lang;
  persistLang(lang);
  applyLang();
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const dictionaryFor = (lang: Lang): Dictionary => DICTIONARIES[lang];

export const useLang = (): Lang => useSyncExternalStore(subscribe, getLang, getLang);

export const useT = (): Dictionary => DICTIONARIES[useLang()];
