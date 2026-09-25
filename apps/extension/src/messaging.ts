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
]);

export type Request = z.infer<typeof RequestSchema>;

export type ItemBrief = {
  readonly itemId: string;
  readonly title: string;
  readonly username: string;
  readonly host: string;
  readonly hasTotp: boolean;
};

export type Response =
  | { readonly ok: true; readonly kind: "status"; readonly unlocked: boolean; readonly email: string | null }
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
  | { readonly ok: false; readonly message: string };
