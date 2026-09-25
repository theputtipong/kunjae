import { z } from "zod";

import {
  err,
  fromThrowable,
  invalidFormat,
  ok,
  utf8ToBytes,
  bytesToUtf8,
  type Bytes,
  type CryptoError,
  type Result,
} from "@kunjae/core-crypto";

export type ItemContentTooLarge = {
  readonly kind: "ItemContentTooLarge";
  readonly maxBytes: number;
  readonly actualBytes: number;
};

export type DomainError = CryptoError | ItemContentTooLarge;

export type DomainResult<T> = Result<T, DomainError>;

export const MAX_ITEM_CONTENT_BYTES = 32_768;

export const FIELD_LIMITS = {
  title: 200,
  username: 512,
  password: 1024,
  url: 2048,
  urlCount: 32,
  notes: 10_000,
  tagName: 40,
  tagCount: 24,
  customFieldName: 100,
  customFieldValue: 2048,
  customFieldCount: 48,
  totpSecret: 256,
  cardNumber: 32,
  cardholderName: 200,
} as const;

export const CustomFieldSchema = z.strictObject({
  name: z.string().min(1).max(FIELD_LIMITS.customFieldName),
  value: z.string().max(FIELD_LIMITS.customFieldValue),
  hidden: z.boolean(),
});

export type CustomField = z.infer<typeof CustomFieldSchema>;

const BaseItemShape = {
  title: z.string().min(1).max(FIELD_LIMITS.title),
  notes: z.string().max(FIELD_LIMITS.notes),
  tags: z.array(z.string().min(1).max(FIELD_LIMITS.tagName)).max(FIELD_LIMITS.tagCount).readonly(),
  favorite: z.boolean(),
  customFields: z.array(CustomFieldSchema).max(FIELD_LIMITS.customFieldCount).readonly(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
} as const;

export const LoginItemSchema = z.strictObject({
  ...BaseItemShape,
  type: z.literal("login"),
  username: z.string().max(FIELD_LIMITS.username),
  password: z.string().max(FIELD_LIMITS.password),
  urls: z.array(z.string().min(1).max(FIELD_LIMITS.url)).max(FIELD_LIMITS.urlCount).readonly(),
  totpSecret: z.string().max(FIELD_LIMITS.totpSecret),
});

export const SecureNoteItemSchema = z.strictObject({
  ...BaseItemShape,
  type: z.literal("secure-note"),
});

export const CardItemSchema = z.strictObject({
  ...BaseItemShape,
  type: z.literal("card"),
  cardholderName: z.string().max(FIELD_LIMITS.cardholderName),
  number: z.string().max(FIELD_LIMITS.cardNumber),
  expiryMonth: z.string().regex(/^(0[1-9]|1[0-2])$/u, "ต้องเป็นเดือน 01-12").or(z.literal("")),
  expiryYear: z.string().regex(/^\d{4}$/u, "ต้องเป็นปี ค.ศ. 4 หลัก").or(z.literal("")),
  securityCode: z.string().max(8),
});

export const ItemContentSchema = z.discriminatedUnion("type", [
  LoginItemSchema,
  SecureNoteItemSchema,
  CardItemSchema,
]);

export type ItemContent = z.infer<typeof ItemContentSchema>;
export type LoginItem = z.infer<typeof LoginItemSchema>;
export type SecureNoteItem = z.infer<typeof SecureNoteItemSchema>;
export type CardItem = z.infer<typeof CardItemSchema>;

export const ITEM_TYPES = ["login", "secure-note", "card"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const encodeItemContent = (content: ItemContent): DomainResult<Bytes> => {
  const json = fromThrowable(
    () => JSON.stringify(content),
    () => invalidFormat("item-content"),
  );
  if (!json.ok) return json;

  const bytes = utf8ToBytes(json.value);
  if (!bytes.ok) return bytes;

  if (bytes.value.length > MAX_ITEM_CONTENT_BYTES) {
    return err({
      kind: "ItemContentTooLarge",
      maxBytes: MAX_ITEM_CONTENT_BYTES,
      actualBytes: bytes.value.length,
    });
  }

  return ok(bytes.value);
};

export const decodeItemContent = (bytes: Bytes): DomainResult<ItemContent> => {
  const text = bytesToUtf8(bytes);
  if (!text.ok) return text;

  const parsed = fromThrowable(
    () => JSON.parse(text.value) as unknown,
    () => invalidFormat("item-content"),
  );
  if (!parsed.ok) return parsed;

  const validated = ItemContentSchema.safeParse(parsed.value);
  if (!validated.success) return err(invalidFormat("item-content"));

  return ok(validated.data);
};

export const baseItemDefaults = (now: string) =>
  ({
    notes: "",
    tags: [],
    favorite: false,
    customFields: [],
    createdAt: now,
    updatedAt: now,
  }) as const;

export const emptyLoginItem = (title: string, now: string): LoginItem => ({
  ...baseItemDefaults(now),
  type: "login",
  title,
  username: "",
  password: "",
  urls: [],
  totpSecret: "",
});

export const emptySecureNoteItem = (title: string, now: string): SecureNoteItem => ({
  ...baseItemDefaults(now),
  type: "secure-note",
  title,
});

export const emptyCardItem = (title: string, now: string): CardItem => ({
  ...baseItemDefaults(now),
  type: "card",
  title,
  cardholderName: "",
  number: "",
  expiryMonth: "",
  expiryYear: "",
  securityCode: "",
});

export const emptyItemOfType = (type: ItemType, title: string, now: string): ItemContent => {
  switch (type) {
    case "login":
      return emptyLoginItem(title, now);
    case "secure-note":
      return emptySecureNoteItem(title, now);
    case "card":
      return emptyCardItem(title, now);
  }
};

export const ITEM_TYPE_LABELS: Readonly<Record<ItemType, string>> = {
  login: "เข้าสู่ระบบ",
  "secure-note": "โน้ตลับ",
  card: "บัตร",
};
