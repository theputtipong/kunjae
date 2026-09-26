import { z } from "zod";

export const UnlockRequestSchema = z.strictObject({
  kind: z.literal("unlock"),
  email: z.string().min(1).max(254),
  masterPassword: z.string().min(1).max(1024),
  secretKeyText: z.string().min(1).max(256),
});

export const LockRequestSchema = z.strictObject({ kind: z.literal("lock") });

export const StatusRequestSchema = z.strictObject({
  kind: z.literal("status"),
  theme: z.enum(["light", "dark"]).optional(),
});

export const ListRequestSchema = z.strictObject({ kind: z.literal("list") });

export const RevealRequestSchema = z.strictObject({
  kind: z.literal("reveal"),
  itemId: z.string().length(26),
});

export const FillRequestSchema = z.strictObject({
  kind: z.literal("fill"),
  itemId: z.string().length(26),
});

export const TotpRequestSchema = z.strictObject({
  kind: z.literal("totp"),
  itemId: z.string().length(26),
});

export const LoadForEditRequestSchema = z.strictObject({
  kind: z.literal("load-for-edit"),
  itemId: z.string().length(26),
});

export const SaveItemRequestSchema = z.strictObject({
  kind: z.literal("save"),
  itemId: z.string().length(26).nullable(),
  title: z.string().min(1).max(200),
  username: z.string().max(512),
  password: z.string().max(1024),
  url: z.string().max(2048),
  totpSecret: z.string().max(256),
});

export const FillTotpRequestSchema = z.strictObject({
  kind: z.literal("fill-totp"),
  itemId: z.string().length(26),
});

export const SignUpRequestSchema = z.strictObject({
  kind: z.literal("sign-up"),
  email: z.email().max(320),
  masterPassword: z.string().min(12).max(1024),
});

const DevicePasswordSchema = z.string().min(12).max(1024);

export const LocalStatusRequestSchema = z.strictObject({ kind: z.literal("local-status") });

export const LocalCreateRequestSchema = z.strictObject({
  kind: z.literal("local-create"),
  masterPassword: DevicePasswordSchema,
});

export const LocalUnlockRequestSchema = z.strictObject({
  kind: z.literal("local-unlock"),
  masterPassword: DevicePasswordSchema,
});

export const LocalChangePasswordRequestSchema = z.strictObject({
  kind: z.literal("local-change-password"),
  current: DevicePasswordSchema,
  next: DevicePasswordSchema,
});

export const LocalDeleteRequestSchema = z.strictObject({
  kind: z.literal("local-delete"),
  confirm: z.literal(true),
});

export const LocalMigrateRequestSchema = z.strictObject({
  kind: z.literal("local-migrate"),
  devicePassword: DevicePasswordSchema,
});

export const LocalDismissMigrationRequestSchema = z.strictObject({
  kind: z.literal("local-dismiss-migration"),
});

export const RequestSchema = z.discriminatedUnion("kind", [
  UnlockRequestSchema,
  LockRequestSchema,
  StatusRequestSchema,
  ListRequestSchema,
  RevealRequestSchema,
  FillRequestSchema,
  TotpRequestSchema,
  LoadForEditRequestSchema,
  SaveItemRequestSchema,
  FillTotpRequestSchema,
  SignUpRequestSchema,
  LocalStatusRequestSchema,
  LocalCreateRequestSchema,
  LocalUnlockRequestSchema,
  LocalChangePasswordRequestSchema,
  LocalDeleteRequestSchema,
  LocalMigrateRequestSchema,
  LocalDismissMigrationRequestSchema,
]);

export type Request = z.infer<typeof RequestSchema>;

export type ErrorCode =
  | "invalid-request"
  | "item-not-found"
  | "no-active-tab"
  | "no-saved-url"
  | "unsupported-page"
  | "no-tab-access"
  | "page-inaccessible"
  | "no-password-field"
  | "no-totp"
  | "totp-fill-unavailable"
  | "totp-unreadable"
  | "no-otp-field"
  | "unlock-failed"
  | "sync-failed"
  | "sign-up-failed"
  | "edit-unsupported"
  | "no-vault"
  | "id-failed"
  | "save-conflict"
  | "wrong-device-password"
  | "local-vault-exists"
  | "local-vault-missing"
  | "local-vault-corrupt"
  | "local-storage-failed"
  | "account-required"
  | "session-expired"
  | "offline"
  | "internal"
  | "no-response"
  | "bad-response";

export type ErrorResponse =
  | { readonly ok: false; readonly error: ErrorCode }
  | {
      readonly ok: false;
      readonly error: "origin-mismatch";
      readonly tabOrigin: string;
      readonly savedOrigin: string;
    };

export type ItemBrief = {
  readonly itemId: string;
  readonly title: string;
  readonly username: string;
  readonly host: string;
  readonly hasTotp: boolean;
};

export type SessionMode = "account" | "local";

export type LocalBrief = {
  readonly exists: boolean;
  readonly itemCount: number | null;
  readonly offerMigration: boolean;
};

export type MigrationResult = {
  readonly moved: number;
  readonly failed: number;
  readonly cleared: boolean;
};

export type Response =
  | {
      readonly ok: true;
      readonly kind: "status";
      readonly unlocked: boolean;
      readonly mode: SessionMode | null;
      readonly email: string | null;
      readonly local: LocalBrief;
    }
  | { readonly ok: true; readonly kind: "local-status"; readonly local: LocalBrief }
  | ({ readonly ok: true; readonly kind: "migrated" } & MigrationResult)
  | { readonly ok: true; readonly kind: "list"; readonly items: readonly ItemBrief[] }
  | { readonly ok: true; readonly kind: "reveal"; readonly password: string }
  | {
      readonly ok: true;
      readonly kind: "emergency-kit";
      readonly email: string;
      readonly secretKey: string;
    }
  | {
      readonly ok: true;
      readonly kind: "editable";
      readonly title: string;
      readonly username: string;
      readonly password: string;
      readonly url: string;
      readonly totpSecret: string;
    }
  | {
      readonly ok: true;
      readonly kind: "totp";
      readonly code: string;
      readonly secondsRemaining: number;
    }
  | { readonly ok: true; readonly kind: "done" }
  | ErrorResponse;
