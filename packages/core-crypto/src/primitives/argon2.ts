import { argon2id } from "hash-wasm";

import { ok, err, fromPromise } from "../result.ts";
import { invalidParameter, keyDerivationFailed, type CryptoResult } from "../errors.ts";
import type { Bytes } from "../types.ts";

export type Argon2Params = {
  readonly memoryKiB: number;
  readonly iterations: number;
  readonly parallelism: number;
  readonly hashLength: number;
};

export const ARGON2_PARAMS_V1: Argon2Params = {
  memoryKiB: 65_536,
  iterations: 3,
  parallelism: 1,
  hashLength: 32,
};

const LIMITS = {
  memoryKiB: { min: 19_456, max: 1_048_576 },
  iterations: { min: 2, max: 16 },
  parallelism: { min: 1, max: 4 },
  hashLength: { min: 16, max: 64 },
  saltBytes: { min: 16 },
  passwordBytes: { min: 1 },
} as const;

const withinRange = (value: number, range: { min: number; max: number }): boolean =>
  Number.isInteger(value) && value >= range.min && value <= range.max;

export const validateArgon2Params = (params: Argon2Params): CryptoResult<Argon2Params> => {
  if (!withinRange(params.memoryKiB, LIMITS.memoryKiB)) {
    return err(invalidParameter("memoryKiB"));
  }
  if (!withinRange(params.iterations, LIMITS.iterations)) {
    return err(invalidParameter("iterations"));
  }
  if (!withinRange(params.parallelism, LIMITS.parallelism)) {
    return err(invalidParameter("parallelism"));
  }
  if (!withinRange(params.hashLength, LIMITS.hashLength)) {
    return err(invalidParameter("hashLength"));
  }
  if (params.memoryKiB < 8 * params.parallelism) {
    return err(invalidParameter("memoryKiB"));
  }
  return ok(params);
};

export const deriveKeyFromPassword = async (
  password: Bytes,
  salt: Bytes,
  params: Argon2Params,
): Promise<CryptoResult<Bytes>> => {
  if (password.length < LIMITS.passwordBytes.min) return err(invalidParameter("password"));
  if (salt.length < LIMITS.saltBytes.min) return err(invalidParameter("salt"));

  const validated = validateArgon2Params(params);
  if (!validated.ok) return validated;

  const derived = await fromPromise(
    argon2id({
      password,
      salt,
      memorySize: params.memoryKiB,
      iterations: params.iterations,
      parallelism: params.parallelism,
      hashLength: params.hashLength,
      outputType: "binary",
    }),
    () => keyDerivationFailed(),
  );
  if (!derived.ok) return derived;

  const key = Uint8Array.from(derived.value);
  derived.value.fill(0);

  return ok(key);
};
