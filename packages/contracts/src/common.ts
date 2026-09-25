import { z } from "zod";

import {
  base64UrlToBytes,
  validateArgon2Params,
  type Argon2Params,
  type Envelope,
} from "@kunjae/core-crypto";

export const LIMITS = {
  email: 254,
  id: 26,
  nonce: 32,
  ciphertext: 65_536,
  base64UrlValue: 512,
} as const;

export const base64UrlBytes = (minBytes: number, maxBytes: number) =>
  z
    .string()
    .max(LIMITS.base64UrlValue)
    .regex(/^[A-Za-z0-9_-]+$/u, "ต้องเป็น base64url ที่ไม่มี padding")
    .refine(
      (value) => {
        const decoded = base64UrlToBytes(value);
        return decoded.ok && decoded.value.length >= minBytes && decoded.value.length <= maxBytes;
      },
      { message: `ต้องถอดรหัสได้ และมีความยาว ${String(minBytes)}-${String(maxBytes)} ไบต์` },
    );

export const UlidSchema = z
  .string()
  .length(LIMITS.id)
  .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/u, "ต้องเป็น ULID (Crockford Base32 26 อักขระ)");

export const EmailSchema = z.email().max(LIMITS.email).toLowerCase();

export const IsoDateTimeSchema = z.iso.datetime({ offset: true });

export const EnvelopeSchema = z.strictObject({
  v: z.literal(1),
  alg: z.literal("A256GCM"),
  n: z.string().max(LIMITS.nonce).regex(/^[A-Za-z0-9_-]+$/u),
  ct: z.string().max(LIMITS.ciphertext).regex(/^[A-Za-z0-9_-]+$/u),
});

export type EnvelopeDto = z.infer<typeof EnvelopeSchema>;

export const toEnvelope = (dto: EnvelopeDto): Envelope => dto;

export const Argon2ParamsSchema = z
  .strictObject({
    memoryKiB: z.int().positive(),
    iterations: z.int().positive(),
    parallelism: z.int().positive(),
    hashLength: z.int().positive(),
  })
  .refine((params) => validateArgon2Params(params).ok, {
    message: "พารามิเตอร์ Argon2id ต่ำกว่าเกณฑ์ขั้นต่ำหรือสูงจนเป็นอันตราย",
  });

export type Argon2ParamsDto = z.infer<typeof Argon2ParamsSchema>;

export const toArgon2Params = (dto: Argon2ParamsDto): Argon2Params => dto;

export const AccountSaltSchema = base64UrlBytes(16, 64);

export const AuthKeySchema = base64UrlBytes(32, 32);
