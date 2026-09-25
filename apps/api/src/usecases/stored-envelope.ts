import { EnvelopeSchema, type EnvelopeDto } from "@kunjae/contracts";
import { err, fromThrowable, ok } from "@kunjae/core-crypto";

import { internal, type UseCaseResult } from "./errors.ts";

export const parseStoredEnvelope = (text: string): UseCaseResult<EnvelopeDto> => {
  const parsed = fromThrowable(
    (): unknown => JSON.parse(text),
    () => internal(),
  );
  if (!parsed.ok) return parsed;

  const envelope = EnvelopeSchema.safeParse(parsed.value);
  if (!envelope.success) return err(internal());

  return ok(envelope.data);
};
