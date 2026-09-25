import type { ChangeMasterPasswordRequest, ChangeMasterPasswordResponse } from "@kunjae/contracts";
import { err, ok } from "@kunjae/core-crypto";

import { hashAuthKey, verifyAuthKey } from "../crypto/auth-key.ts";
import { issueToken } from "../crypto/token.ts";
import { findAccountById, rotateCredentials } from "../db/accounts.ts";
import { listVaults } from "../db/vaults.ts";
import { isoNow, type Deps } from "./deps.ts";
import {
  internal,
  invalidCredentials,
  invalidRequest,
  type UseCaseResult,
} from "./errors.ts";

const coversExactly = (owned: readonly string[], rewrapped: readonly string[]): boolean => {
  if (owned.length !== rewrapped.length) return false;

  const provided = new Set(rewrapped);
  if (provided.size !== rewrapped.length) return false;

  return owned.every((vaultId) => provided.has(vaultId));
};

export const changeMasterPassword = async (
  deps: Deps,
  accountId: string,
  request: ChangeMasterPasswordRequest,
): Promise<UseCaseResult<ChangeMasterPasswordResponse>> => {
  const account = await findAccountById(deps.db, accountId);
  if (!account.ok) return err(internal());

  const row = account.value;
  if (row === null) return err(invalidCredentials());

  const matched = await verifyAuthKey(deps.secrets.authPepper, request.currentAuthKey, row.authKeyHash);
  if (!matched.ok) return err(internal());
  if (!matched.value) return err(invalidCredentials());

  const owned = await listVaults(deps.db, accountId);
  if (!owned.ok) return err(internal());

  if (!coversExactly(owned.value.map((vault) => vault.vaultId), request.rewrappedVaults.map((vault) => vault.vaultId))) {
    return err(invalidRequest());
  }

  const newAuthKeyHash = await hashAuthKey(deps.secrets.authPepper, request.newAuthKey);
  if (!newAuthKeyHash.ok) return err(internal());

  const now = isoNow(deps.nowMs);

  const rotated = await rotateCredentials(deps.db, {
    accountId,
    accountSalt: request.newAccountSalt,
    argon2MemoryKib: request.newArgon2.memoryKiB,
    argon2Iterations: request.newArgon2.iterations,
    argon2Parallelism: request.newArgon2.parallelism,
    argon2HashLength: request.newArgon2.hashLength,
    authKeyHash: newAuthKeyHash.value,
    rewrapped: request.rewrappedVaults.map((vault) => ({
      vaultId: vault.vaultId,
      wrappedVaultKey: JSON.stringify(vault.wrappedVaultKey),
    })),
    now,
  });
  if (!rotated.ok) return err(internal());

  const token = await issueToken(deps.secrets.tokenSecret, {
    accountId,
    tokenEpoch: row.tokenEpoch + 1,
    nowMs: deps.nowMs,
  });
  if (!token.ok) return err(internal());

  return ok({
    changedAt: now,
    accessToken: { token: token.value.token, expiresAt: token.value.expiresAt },
  });
};
