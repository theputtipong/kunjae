export type IdleLockOptions = {
  readonly now: () => number;
  readonly idleMs: (nowMs: number) => number | null;
  readonly lock: () => void;
  readonly timeoutMs: number;
  readonly intervalMs: number;
};

export const isIdleExpired = (idle: number | null, timeoutMs: number): boolean =>
  idle !== null && idle >= timeoutMs;

export const startIdleLock = (options: IdleLockOptions): (() => void) => {
  const timer = setInterval(() => {
    if (isIdleExpired(options.idleMs(options.now()), options.timeoutMs)) options.lock();
  }, options.intervalMs);

  return () => {
    clearInterval(timer);
  };
};
