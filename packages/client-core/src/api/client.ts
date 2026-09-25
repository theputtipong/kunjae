import {
  ApiErrorResponseSchema,
  ChangeMasterPasswordResponseSchema,
  CreateVaultResponseSchema,
  DeleteAccountResponseSchema,
  RevokeSessionsResponseSchema,
  LoginBeginResponseSchema,
  LoginFinishResponseSchema,
  SignUpResponseSchema,
  SyncPullResponseSchema,
  SyncPushResponseSchema,
  type ChangeMasterPasswordRequest,
  type CreateVaultRequest,
  type CreateVaultResponse,
  type ChangeMasterPasswordResponse,
  type DeleteAccountRequest,
  type DeleteAccountResponse,
  type RevokeSessionsRequest,
  type RevokeSessionsResponse,
  type LoginBeginRequest,
  type LoginBeginResponse,
  type LoginFinishRequest,
  type LoginFinishResponse,
  type SignUpRequest,
  type SignUpResponse,
  type SyncPullRequest,
  type SyncPullResponse,
  type SyncPushRequest,
  type SyncPushResponse,
} from "@kunjae/contracts";
import { err, ok } from "@kunjae/core-crypto";
import type { z } from "zod";

import { getApiBaseUrl } from "../config.ts";
import {
  apiRejected,
  invalidResponse,
  networkUnavailable,
  requestTimedOut,
  type ApiResult,
} from "./errors.ts";

const TIMEOUT_MS = 20_000;

const MAX_RESPONSE_BYTES = 16_777_216;

const PATHS = {
  signUp: "/v1/auth/sign-up",
  loginBegin: "/v1/auth/login/begin",
  loginFinish: "/v1/auth/login/finish",
  changePassword: "/v1/auth/change-password",
  deleteAccount: "/v1/account/delete",
  createVault: "/v1/vaults",
  revokeSessions: "/v1/auth/revoke-sessions",
  syncPull: "/v1/sync/pull",
  syncPush: "/v1/sync/push",
} as const;

const request = async <S extends z.ZodType>(
  path: string,
  body: unknown,
  schema: S,
  token?: string,
): Promise<ApiResult<z.infer<S>>> => {
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(body),

      credentials: "omit",

      cache: "no-store",

      redirect: "error",

      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "TimeoutError") {
      return err(requestTimedOut());
    }
    return err(networkUnavailable());
  }

  const declaredLength = Number(response.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    return err(invalidResponse());
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return err(invalidResponse());
  }

  if (!response.ok) {
    const parsed = ApiErrorResponseSchema.safeParse(payload);
    if (!parsed.success) return err(invalidResponse());

    return err(apiRejected(parsed.data.code, parsed.data.requestId));
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) return err(invalidResponse());

  return ok(parsed.data);
};

export const apiSignUp = (body: SignUpRequest): Promise<ApiResult<SignUpResponse>> =>
  request(PATHS.signUp, body, SignUpResponseSchema);

export const apiLoginBegin = (body: LoginBeginRequest): Promise<ApiResult<LoginBeginResponse>> =>
  request(PATHS.loginBegin, body, LoginBeginResponseSchema);

export const apiLoginFinish = (body: LoginFinishRequest): Promise<ApiResult<LoginFinishResponse>> =>
  request(PATHS.loginFinish, body, LoginFinishResponseSchema);

export const apiChangeMasterPassword = (
  body: ChangeMasterPasswordRequest,
  token: string,
): Promise<ApiResult<ChangeMasterPasswordResponse>> =>
  request(PATHS.changePassword, body, ChangeMasterPasswordResponseSchema, token);

export const apiDeleteAccount = (
  body: DeleteAccountRequest,
  token: string,
): Promise<ApiResult<DeleteAccountResponse>> =>
  request(PATHS.deleteAccount, body, DeleteAccountResponseSchema, token);

export const apiCreateVault = (
  body: CreateVaultRequest,
  token: string,
): Promise<ApiResult<CreateVaultResponse>> =>
  request(PATHS.createVault, body, CreateVaultResponseSchema, token);

export const apiRevokeSessions = (
  body: RevokeSessionsRequest,
  token: string,
): Promise<ApiResult<RevokeSessionsResponse>> =>
  request(PATHS.revokeSessions, body, RevokeSessionsResponseSchema, token);

export const apiSyncPull = (
  body: SyncPullRequest,
  token: string,
): Promise<ApiResult<SyncPullResponse>> => request(PATHS.syncPull, body, SyncPullResponseSchema, token);

export const apiSyncPush = (
  body: SyncPushRequest,
  token: string,
): Promise<ApiResult<SyncPushResponse>> => request(PATHS.syncPush, body, SyncPushResponseSchema, token);
