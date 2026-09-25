export type Ok<T> = {
  readonly ok: true;
  readonly value: T;
};

export type Err<E> = {
  readonly ok: false;
  readonly error: E;
};

export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.ok;

export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => !r.ok;

export const map =
  <T, U>(fn: (value: T) => U) =>
  <E>(r: Result<T, E>): Result<U, E> =>
    r.ok ? ok(fn(r.value)) : r;

export const mapErr =
  <E, F>(fn: (error: E) => F) =>
  <T>(r: Result<T, E>): Result<T, F> =>
    r.ok ? r : err(fn(r.error));

export const andThen =
  <T, U, F>(fn: (value: T) => Result<U, F>) =>
  <E>(r: Result<T, E>): Result<U, E | F> =>
    r.ok ? fn(r.value) : r;

export const unwrapOr =
  <T>(fallback: T) =>
  <E>(r: Result<T, E>): T =>
    r.ok ? r.value : fallback;

export const match =
  <T, E, U>(handlers: { readonly onOk: (value: T) => U; readonly onErr: (error: E) => U }) =>
  (r: Result<T, E>): U =>
    r.ok ? handlers.onOk(r.value) : handlers.onErr(r.error);

export const all = <T, E>(results: readonly Result<T, E>[]): Result<readonly T[], E> => {
  const values: T[] = [];
  for (const r of results) {
    if (!r.ok) return r;
    values.push(r.value);
  }
  return ok(values);
};

export const fromThrowable = <T, E>(
  fn: () => T,
  onThrow: (cause: unknown) => E,
): Result<T, E> => {
  try {
    return ok(fn());
  } catch (cause) {
    return err(onThrow(cause));
  }
};

export const fromPromise = async <T, E>(
  promise: Promise<T>,
  onThrow: (cause: unknown) => E,
): Promise<Result<T, E>> => {
  try {
    return ok(await promise);
  } catch (cause) {
    return err(onThrow(cause));
  }
};
