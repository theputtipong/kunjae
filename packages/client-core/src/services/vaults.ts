import { createVault as createVaultContent } from "@kunjae/domain";

import { apiCreateVault } from "../api/client.ts";
import { addUnlockedVault, isLocalSession, withWrappingKey } from "../session/vault-session.ts";
import { createLocalVaultEntry } from "../local/local-store.ts";
import { createUlid } from "../lib/ulid.ts";
import { upsertVault } from "../store/vault-store.ts";
import { ensureToken } from "./auth.ts";
import {
  fromApiError,
  lockIfSessionExpired,
  sessionExpired,
  unexpected,
  type AppResult,
} from "./errors.ts";
import { err, ok } from "@kunjae/core-crypto";

export type CreateVaultParams = {
  readonly name: string;
  readonly nowMs: number;
};

export const createNewVault = async (params: CreateVaultParams): Promise<AppResult<string>> => {
  if (isLocalSession()) return createLocalVaultEntry(params);

  const token = await ensureToken(params.nowMs);
  if (!token.ok) return token;

  const vaultId = createUlid(params.nowMs);
  if (!vaultId.ok) return err(unexpected());

  const now = new Date(params.nowMs).toISOString();

  const created = await withWrappingKey(async (wrappingKey) =>
    createVaultContent(wrappingKey, {
      vaultId: vaultId.value,
      name: params.name,
      icon: "",
      color: "",
      now,
    }),
  );

  if (created === null) return err(sessionExpired());
  if (!created.ok) return err(unexpected());

  const sent = await apiCreateVault({ vault: created.value.payload }, token.value);
  if (!sent.ok) return err(lockIfSessionExpired(fromApiError(sent.error)));

  addUnlockedVault({ vaultId: vaultId.value, key: created.value.key });

  upsertVault({
    vaultId: vaultId.value,
    version: 1,
    metadata: { name: params.name, icon: "", color: "", createdAt: now, updatedAt: now },
    wrapped: {
      vaultId: vaultId.value,
      wrappedVaultKey: created.value.payload.wrappedVaultKey,
    },
  });

  return ok(vaultId.value);
};
