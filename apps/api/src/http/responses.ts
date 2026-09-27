import type { ApiErrorCode, ApiErrorResponse } from "@kunjae/contracts";
import { bytesToBase32, randomBytes } from "@kunjae/core-crypto";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { UseCaseError } from "../usecases/errors.ts";

export const newRequestId = (): string => {
  const bytes = randomBytes(16);
  return bytes.ok ? bytesToBase32(bytes.value) : "0".repeat(26);
};

const ERROR_MAP: Record<UseCaseError["kind"], { status: ContentfulStatusCode; code: ApiErrorCode }> = {
  InvalidRequest: { status: 400, code: "INVALID_REQUEST" },
  InvalidCredentials: { status: 401, code: "INVALID_CREDENTIALS" },
  Unauthorized: { status: 401, code: "UNAUTHORIZED" },
  Conflict: { status: 409, code: "CONFLICT" },
  Internal: { status: 500, code: "INTERNAL" },
  RateLimited: { status: 429, code: "RATE_LIMITED" },
};

export type ErrorPayload = {
  readonly status: ContentfulStatusCode;
  readonly body: ApiErrorResponse;
};

export const toErrorPayload = (error: UseCaseError): ErrorPayload => {
  const mapped = ERROR_MAP[error.kind];
  return { status: mapped.status, body: { code: mapped.code, requestId: newRequestId() } };
};

export const errorPayload = (status: ContentfulStatusCode, code: ApiErrorCode): ErrorPayload => ({
  status,
  body: { code, requestId: newRequestId() },
});
