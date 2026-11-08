export type ClipboardGuardOptions = {
  readonly write: (text: string) => Promise<void>;
  readonly onRefocus: (listener: () => void) => () => void;
  readonly clearAfterMs: number;
};

export type ClipboardGuard = {
  readonly copy: (value: string) => Promise<boolean>;
};

export const createClipboardGuard = (options: ClipboardGuardOptions): ClipboardGuard => {
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribe: (() => void) | null = null;

  const stopWaiting = (): void => {
    unsubscribe?.();
    unsubscribe = null;
  };

  const cancel = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    stopWaiting();
  };

  const attemptClear = (current: number): void => {
    options.write("").then(
      () => undefined,
      () => {
        if (current !== generation) return;
        stopWaiting();
        unsubscribe = options.onRefocus(() => {
          stopWaiting();
          attemptClear(current);
        });
      },
    );
  };

  const copy = async (value: string): Promise<boolean> => {
    cancel();
    generation += 1;
    const current = generation;

    try {
      await options.write(value);
    } catch {
      return false;
    }

    if (current !== generation) return true;

    timer = setTimeout(() => {
      timer = null;
      attemptClear(current);
    }, options.clearAfterMs);

    return true;
  };

  return { copy };
};
