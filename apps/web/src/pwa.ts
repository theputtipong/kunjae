export type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type Listener = () => void;

let deferredInstall: BeforeInstallPromptEvent | null = null;
const listeners = new Set<Listener>();

const notify = (): void => {
  for (const listener of listeners) listener();
};

export const getDeferredInstall = (): BeforeInstallPromptEvent | null => deferredInstall;

export const clearDeferredInstall = (): void => {
  deferredInstall = null;
  notify();
};

export const onInstallAvailabilityChange = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const startPwa = (): void => {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstall = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstall = null;
    notify();
  });

  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    });
  }
};
