import type { ApiErrorCode } from "@kunjae/contracts";
import type { Result } from "@kunjae/core-crypto";

export type NetworkUnavailable = { readonly kind: "NetworkUnavailable" };

export type RequestTimedOut = { readonly kind: "RequestTimedOut" };

export type ApiRejected = {
  readonly kind: "ApiRejected";
  readonly code: ApiErrorCode;
  readonly requestId: string;
};

export type InvalidResponse = { readonly kind: "InvalidResponse" };

export type ApiError = NetworkUnavailable | RequestTimedOut | ApiRejected | InvalidResponse;

export type ApiResult<T> = Result<T, ApiError>;

export const networkUnavailable = (): NetworkUnavailable => ({ kind: "NetworkUnavailable" });
export const requestTimedOut = (): RequestTimedOut => ({ kind: "RequestTimedOut" });
export const invalidResponse = (): InvalidResponse => ({ kind: "InvalidResponse" });
export const apiRejected = (code: ApiErrorCode, requestId: string): ApiRejected => ({
  kind: "ApiRejected",
  code,
  requestId,
});
