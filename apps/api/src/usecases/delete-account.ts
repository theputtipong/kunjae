import type { DeleteAccountRequest, DeleteAccountResponse } from "@kunjae/contracts";
import { err, ok } from "@kunjae/core-crypto";

import { verifyAuthKey } from "../crypto/auth-key.ts";
import { deleteAccount as deleteAccountRow, findAccountById } from "../db/accounts.ts";
import { isoNow, type Deps } from "./deps.ts";
import { internal, invalidCredentials, type UseCaseResult } from "./errors.ts";

export const deleteAccount = async (
  deps: Deps,
  accountId: string,
  request: DeleteAccountRequest,
): Promise<UseCaseResult<DeleteAccountResponse>> => {
  const account = await findAccountById(deps.db, accountId);
  if (!account.ok) return err(internal());

  const row = account.value;
  if (row === null) return err(invalidCredentials());

  const matched = await verifyAuthKey(deps.secrets.authPepper, request.currentAuthKey, row.authKeyHash);
  if (!matched.ok) return err(internal());
  if (!matched.value) return err(invalidCredentials());

  const deleted = await deleteAccountRow(deps.db, accountId);
  if (!deleted.ok) return err(internal());

  return ok({ deletedAt: isoNow(deps.nowMs) });
};
