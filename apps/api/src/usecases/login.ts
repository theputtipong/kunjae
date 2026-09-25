import type {
  LoginBeginRequest,
  LoginBeginResponse,
  LoginFinishRequest,
  LoginFinishResponse,
  VaultKeyBundle,
} from "@kunjae/contracts";
import { err, ok } from "@kunjae/core-crypto";

import { verifyAuthKey } from "../crypto/auth-key.ts";
import { buildDecoyChallenge } from "../crypto/challenge.ts";
import { issueToken } from "../crypto/token.ts";
import { findAccountByEmail } from "../db/accounts.ts";
import { listVaults } from "../db/vaults.ts";
import type { Deps } from "./deps.ts";
import { parseStoredEnvelope } from "./stored-envelope.ts";
import { internal, invalidCredentials, type UseCaseResult } from "./errors.ts";

const DECOY_AUTH_KEY_HASH = "A".repeat(43);

export const loginBegin = async (
  deps: Deps,
  request: LoginBeginRequest,
): Promise<UseCaseResult<LoginBeginResponse>> => {
  const account = await findAccountByEmail(deps.db, request.email);
  const decoy = await buildDecoyChallenge(deps.secrets.challengeKey, request.email);

  if (!account.ok || !decoy.ok) return err(internal());

  const row = account.value;
  if (row === null) return ok(decoy.value);

  return ok({
    accountSalt: row.accountSalt,
    argon2: {
      memoryKiB: row.argon2MemoryKib,
      iterations: row.argon2Iterations,
      parallelism: row.argon2Parallelism,
      hashLength: row.argon2HashLength,
    },
  });
};

export const loginFinish = async (
  deps: Deps,
  request: LoginFinishRequest,
): Promise<UseCaseResult<LoginFinishResponse>> => {
  const account = await findAccountByEmail(deps.db, request.email);
  if (!account.ok) return err(internal());

  const row = account.value;

  const matched = await verifyAuthKey(
    deps.secrets.authPepper,
    request.authKey,
    row?.authKeyHash ?? DECOY_AUTH_KEY_HASH,
  );
  if (!matched.ok) return err(internal());

  if (row === null || !matched.value) return err(invalidCredentials());

  const vaults = await listVaults(deps.db, row.accountId);
  if (!vaults.ok) return err(internal());

  if (vaults.value.length === 0) return err(internal());

  const bundles: VaultKeyBundle[] = [];
  for (const vault of vaults.value) {
    const parsed = parseStoredEnvelope(vault.wrappedVaultKey);
    if (!parsed.ok) return parsed;

    bundles.push({ vaultId: vault.vaultId, wrappedVaultKey: parsed.value });
  }

  const token = await issueToken(deps.secrets.tokenSecret, {
    accountId: row.accountId,
    tokenEpoch: row.tokenEpoch,
    nowMs: deps.nowMs,
  });
  if (!token.ok) return err(internal());

  return ok({
    accountId: row.accountId,
    accessToken: { token: token.value.token, expiresAt: token.value.expiresAt },
    vaults: bundles,
  });
};
