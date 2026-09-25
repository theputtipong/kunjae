import type { Result } from "@kunjae/core-crypto";

export type InvalidCredentials = { readonly kind: "InvalidCredentials" };

export type Unauthorized = { readonly kind: "Unauthorized" };

export type Conflict = { readonly kind: "Conflict" };

export type InvalidRequest = { readonly kind: "InvalidRequest" };

export type Internal = { readonly kind: "Internal" };

export type UseCaseError = InvalidCredentials | Unauthorized | Conflict | InvalidRequest | Internal;

export type UseCaseResult<T> = Result<T, UseCaseError>;

export const invalidCredentials = (): InvalidCredentials => ({ kind: "InvalidCredentials" });
export const unauthorized = (): Unauthorized => ({ kind: "Unauthorized" });
export const conflict = (): Conflict => ({ kind: "Conflict" });
export const invalidRequest = (): InvalidRequest => ({ kind: "InvalidRequest" });
export const internal = (): Internal => ({ kind: "Internal" });
