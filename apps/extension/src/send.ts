import { browser } from "#imports";

import type { Request, Response } from "./messaging.ts";

export const send = async (request: Request): Promise<Response> => {
  const response: unknown = await browser.runtime.sendMessage(request);

  if (typeof response !== "object" || response === null || !("ok" in response)) {
    return { ok: false, error: "no-response" };
  }

  return response as Response;
};
