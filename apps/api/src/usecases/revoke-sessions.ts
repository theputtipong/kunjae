import type { RevokeSessionsRequest, RevokeSessionsResponse } from "@kunjae/contracts";
import { err, ok } from "@kunjae/core-crypto";

import { verifyAuthKey } from "../crypto/auth-key.ts";
import { issueToken } from "../crypto/token.ts";
import { findAccountById, revokeAllTokens } from "../db/accounts.ts";
import { isoNow, type Deps } from "./deps.ts";
import { internal, invalidCredentials, type UseCaseResult } from "./errors.ts";

export const revokeSessions = async (
  deps: Deps,
  accountId: string,
  request: RevokeSessionsRequest,
): Promise<UseCaseResult<RevokeSessionsResponse>> => {
  const account = await findAccountById(deps.db, accountId);
  if (!account.ok) return err(internal());

  const row = account.value;
  if (row === null) return err(invalidCredentials());

  const matched = await verifyAuthKey(deps.secrets.authPepper, request.currentAuthKey, row.authKeyHash);
  if (!matched.ok) return err(internal());
  if (!matched.value) return err(invalidCredentials());

  const now = isoNow(deps.nowMs);

  const revoked = await revokeAllTokens(deps.db, accountId, now);
  if (!revoked.ok) return err(internal());

  const token = await issueToken(deps.secrets.tokenSecret, {
    accountId,
    tokenEpoch: row.tokenEpoch + 1,
    nowMs: deps.nowMs,
  });
  if (!token.ok) return err(internal());

  return ok({ revokedAt: now, accessToken: token.value });
};
