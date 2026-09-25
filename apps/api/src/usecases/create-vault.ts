import type { CreateVaultRequest, CreateVaultResponse } from "@kunjae/contracts";
import { SYNC_LIMITS } from "@kunjae/contracts";
import { err, ok } from "@kunjae/core-crypto";

import { countVaults, insertVault } from "../db/vaults.ts";
import { isoNow, type Deps } from "./deps.ts";
import { conflict, internal, type UseCaseResult } from "./errors.ts";

export const createVault = async (
  deps: Deps,
  accountId: string,
  request: CreateVaultRequest,
): Promise<UseCaseResult<CreateVaultResponse>> => {
  const existing = await countVaults(deps.db, accountId);
  if (!existing.ok) return err(internal());

  if (existing.value >= SYNC_LIMITS.vaultsPerAccount) return err(conflict());

  const now = isoNow(deps.nowMs);

  const inserted = await insertVault(deps.db, {
    accountId,
    vaultId: request.vault.vaultId,
    wrappedVaultKey: JSON.stringify(request.vault.wrappedVaultKey),
    metadata: JSON.stringify(request.vault.metadata),
    now,
  });

  if (!inserted.ok) return err(conflict());

  return ok({ vaultId: request.vault.vaultId, createdAt: now });
};
