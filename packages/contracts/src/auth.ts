import { z } from "zod";

import {
  AccountSaltSchema,
  Argon2ParamsSchema,
  AuthKeySchema,
  EmailSchema,
  EnvelopeSchema,
  IsoDateTimeSchema,
  UlidSchema,
} from "./common.ts";

export const VaultKeyBundleSchema = z.strictObject({
  vaultId: UlidSchema,
  wrappedVaultKey: EnvelopeSchema,
});

export type VaultKeyBundle = z.infer<typeof VaultKeyBundleSchema>;

export const NewVaultSchema = VaultKeyBundleSchema.extend({
  metadata: EnvelopeSchema,
});

export type NewVault = z.infer<typeof NewVaultSchema>;

export const KdfChallengeSchema = z.strictObject({
  accountSalt: AccountSaltSchema,
  argon2: Argon2ParamsSchema,
});

export type KdfChallenge = z.infer<typeof KdfChallengeSchema>;

export const SignUpRequestSchema = z.strictObject({
  email: EmailSchema,

  accountId: UlidSchema,

  accountSalt: AccountSaltSchema,

  argon2: Argon2ParamsSchema,

  authKey: AuthKeySchema,

  vault: NewVaultSchema,
});

export type SignUpRequest = z.infer<typeof SignUpRequestSchema>;

export const SignUpResponseSchema = z.strictObject({
  accountId: UlidSchema,
  createdAt: IsoDateTimeSchema,
});

export type SignUpResponse = z.infer<typeof SignUpResponseSchema>;

export const LoginBeginRequestSchema = z.strictObject({
  email: EmailSchema,
});

export type LoginBeginRequest = z.infer<typeof LoginBeginRequestSchema>;

export const LoginBeginResponseSchema = KdfChallengeSchema;

export type LoginBeginResponse = z.infer<typeof LoginBeginResponseSchema>;

export const LoginFinishRequestSchema = z.strictObject({
  email: EmailSchema,

  authKey: AuthKeySchema,
});

export type LoginFinishRequest = z.infer<typeof LoginFinishRequestSchema>;

const MAX_TOKEN_LENGTH = 4096;

export const AccessTokenSchema = z.strictObject({
  token: z.string().min(1).max(MAX_TOKEN_LENGTH),
  expiresAt: IsoDateTimeSchema,
});

export type AccessToken = z.infer<typeof AccessTokenSchema>;

export const LoginFinishResponseSchema = z.strictObject({
  accountId: UlidSchema,
  accessToken: AccessTokenSchema,
  vaults: z.array(VaultKeyBundleSchema).min(1).max(64),
});

export type LoginFinishResponse = z.infer<typeof LoginFinishResponseSchema>;

export const ChangeMasterPasswordRequestSchema = z.strictObject({
  currentAuthKey: AuthKeySchema,

  newAccountSalt: AccountSaltSchema,
  newArgon2: Argon2ParamsSchema,
  newAuthKey: AuthKeySchema,

  rewrappedVaults: z.array(VaultKeyBundleSchema).min(1).max(64),
});

export type ChangeMasterPasswordRequest = z.infer<typeof ChangeMasterPasswordRequestSchema>;

export const ChangeMasterPasswordResponseSchema = z.strictObject({
  changedAt: IsoDateTimeSchema,
  accessToken: AccessTokenSchema,
});

export type ChangeMasterPasswordResponse = z.infer<typeof ChangeMasterPasswordResponseSchema>;

export const CreateVaultRequestSchema = z.strictObject({
  vault: NewVaultSchema,
});

export type CreateVaultRequest = z.infer<typeof CreateVaultRequestSchema>;

export const CreateVaultResponseSchema = z.strictObject({
  vaultId: UlidSchema,
  createdAt: IsoDateTimeSchema,
});

export type CreateVaultResponse = z.infer<typeof CreateVaultResponseSchema>;

export const RevokeSessionsRequestSchema = z.strictObject({
  currentAuthKey: AuthKeySchema,
});

export type RevokeSessionsRequest = z.infer<typeof RevokeSessionsRequestSchema>;

export const RevokeSessionsResponseSchema = z.strictObject({
  revokedAt: IsoDateTimeSchema,
  accessToken: AccessTokenSchema,
});

export type RevokeSessionsResponse = z.infer<typeof RevokeSessionsResponseSchema>;

export const DeleteAccountRequestSchema = z.strictObject({
  currentAuthKey: AuthKeySchema,
});

export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;

export const DeleteAccountResponseSchema = z.strictObject({
  deletedAt: IsoDateTimeSchema,
});

export type DeleteAccountResponse = z.infer<typeof DeleteAccountResponseSchema>;

export const ApiErrorCodeSchema = z.enum([
  "INVALID_REQUEST",
  "INVALID_CREDENTIALS",
  "UNAUTHORIZED",
  "CONFLICT",
  "RATE_LIMITED",
  "NOT_FOUND",
  "INTERNAL",
]);

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorResponseSchema = z.strictObject({
  code: ApiErrorCodeSchema,
  requestId: UlidSchema,
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
