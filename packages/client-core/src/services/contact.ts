import type { ContactRequest } from "@kunjae/contracts";
import { err, ok } from "@kunjae/core-crypto";

import { apiContact } from "../api/client.ts";
import { fromApiError, type AppResult } from "./errors.ts";

export const sendContactMessage = async (message: ContactRequest): Promise<AppResult<void>> => {
  const sent = await apiContact(message);
  return sent.ok ? ok(undefined) : err(fromApiError(sent.error));
};
