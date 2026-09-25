import type { SignUpRequest, SignUpResponse } from "@kunjae/contracts";
import { err, ok } from "@kunjae/core-crypto";

import { hashAuthKey } from "../crypto/auth-key.ts";
import { createAccountWithVault } from "../db/accounts.ts";
import { isoNow, type Deps } from "./deps.ts";
import { conflict, internal, type UseCaseResult } from "./errors.ts";

export const signUp = async (
  deps: Deps,
  request: SignUpRequest,
): Promise<UseCaseResult<SignUpResponse>> => {
  const now = isoNow(deps.nowMs);

  const authKeyHash = await hashAuthKey(deps.secrets.authPepper, request.authKey);
  if (!authKeyHash.ok) return err(internal());

  const created = await createAccountWithVault(deps.db, {
    accountId: request.accountId,
    email: request.email,
    accountSalt: request.accountSalt,
    argon2MemoryKib: request.argon2.memoryKiB,
    argon2Iterations: request.argon2.iterations,
    argon2Parallelism: request.argon2.parallelism,
    argon2HashLength: request.argon2.hashLength,
    authKeyHash: authKeyHash.value,
    vaultId: request.vault.vaultId,

    wrappedVaultKey: JSON.stringify(request.vault.wrappedVaultKey),
    metadata: JSON.stringify(request.vault.metadata),
    now,
  });

  if (!created.ok) {
    const isConflict =
      created.error.kind === "UniqueViolation" || created.error.kind === "ConstraintViolation";
    return err(isConflict ? conflict() : internal());
  }

  return ok({ accountId: request.accountId, createdAt: now });
};
