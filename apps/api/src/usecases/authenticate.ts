import { err, ok } from "@kunjae/core-crypto";

import { verifyToken } from "../crypto/token.ts";
import { findTokenEpoch } from "../db/accounts.ts";
import type { Deps } from "./deps.ts";
import { internal, unauthorized, type UseCaseResult } from "./errors.ts";

export type Identity = {
  readonly accountId: string;
};

export const authenticate = async (
  deps: Deps,
  token: string,
): Promise<UseCaseResult<Identity>> => {
  const claims = await verifyToken(deps.secrets.tokenSecret, token, deps.nowMs);
  if (!claims.ok) return err(unauthorized());

  const currentEpoch = await findTokenEpoch(deps.db, claims.value.sub);
  if (!currentEpoch.ok) return err(internal());

  if (currentEpoch.value === null) return err(unauthorized());

  if (currentEpoch.value !== claims.value.ep) return err(unauthorized());

  return ok({ accountId: claims.value.sub });
};
