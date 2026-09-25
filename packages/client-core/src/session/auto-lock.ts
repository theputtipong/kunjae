import { idleMs, lockSession, markActivity } from "./vault-session.ts";

export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

const CHECK_INTERVAL_MS = 10_000;

const ACTIVITY_EVENTS = ["pointerdown", "keydown"] as const;

export type AutoLockOptions = {
  readonly now: () => number;
  readonly target: EventTarget;
  readonly timeoutMs?: number;
  readonly intervalMs?: number;
};

export const startAutoLock = (options: AutoLockOptions): (() => void) => {
  const timeoutMs = options.timeoutMs ?? IDLE_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? CHECK_INTERVAL_MS;

  const onActivity = (): void => {
    markActivity(options.now());
  };

  const onPageHide = (): void => {
    lockSession();
  };

  for (const event of ACTIVITY_EVENTS) {
    options.target.addEventListener(event, onActivity, { passive: true });
  }
  options.target.addEventListener("pagehide", onPageHide);

  const timer = setInterval(() => {
    const idle = idleMs(options.now());

    if (idle === null) return;

    if (idle >= timeoutMs) lockSession();
  }, intervalMs);

  return () => {
    clearInterval(timer);
    for (const event of ACTIVITY_EVENTS) {
      options.target.removeEventListener(event, onActivity);
    }
    options.target.removeEventListener("pagehide", onPageHide);
  };
};
