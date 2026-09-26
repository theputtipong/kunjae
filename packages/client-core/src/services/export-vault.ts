import { ItemContentSchema, type DecryptedItem, type ItemContent } from "@kunjae/domain";

import { createUlid } from "../lib/ulid.ts";
import { getAllItemsForExport as readAllItems } from "../store/vault-store.ts";
import { saveItem } from "./sync.ts";
import { invalidInput, type AppResult, type MessageLang } from "./errors.ts";

export const EXPORT_FORMAT_VERSION = 1;

export type ExportParams = {
  readonly email: string;
  readonly items: readonly DecryptedItem[];
  readonly vaultNames: ReadonlyMap<string, string>;
  readonly exportedAt: string;
  readonly lang?: MessageLang;
};

const PLAIN_EXPORT_WARNING: Readonly<Record<MessageLang, string>> = {
  en:
    "This file is NOT encrypted and contains all of your passwords in readable form. " +
    "Anyone who can open this file will see everything — keep it safe or delete it when you're done.",
  th:
    "ไฟล์นี้ไม่ได้เข้ารหัส และมีรหัสผ่านทั้งหมดของคุณอยู่ในรูปที่อ่านได้ " +
    "ใครก็ตามที่เปิดไฟล์นี้ได้ จะเห็นทุกอย่าง — เก็บให้ปลอดภัยหรือลบทิ้งเมื่อใช้เสร็จ",
};

const ENCRYPTED_EXPORT_WARNING: Readonly<Record<MessageLang, string>> = {
  en:
    "This file is encrypted with the password you set when exporting. " +
    "If you forget that password, nobody can ever open this file again — including the Kunjae developers.",
  th:
    "ไฟล์นี้เข้ารหัสด้วยรหัสผ่านที่คุณตั้งไว้ตอนส่งออก " +
    "ถ้าลืมรหัสผ่านนั้น จะไม่มีใครเปิดไฟล์นี้ได้อีกเลย รวมถึงผู้พัฒนา Kunjae",
};

export const buildVaultExport = (params: ExportParams): string => {
  const payload = {
    format: "kunjae.export",
    version: EXPORT_FORMAT_VERSION,
    exportedAt: params.exportedAt,
    account: { email: params.email },
    warning: PLAIN_EXPORT_WARNING[params.lang ?? "en"],
    items: params.items.map((item) => ({
      itemId: item.itemId,
      vault: params.vaultNames.get(item.vaultId) ?? item.vaultId,
      ...item.content,
    })),
  };

  return JSON.stringify(payload, null, 2);
};

export const vaultExportFileName = (exportedAt: string): string =>
  `kunjae-export-${exportedAt.slice(0, 10)}.json`;

import {
  ARGON2_PARAMS_V1,
  bytesToBase64Url,
  base64UrlToBytes,
  deriveKeyFromPassword,
  EMPTY_AAD,
  importAeadKey,
  open as aeadOpen,
  randomBytes,
  seal as aeadSeal,
  utf8ToBytes,
  bytesToUtf8,
  validateArgon2Params,
  wipe,
  err,
  invalidFormat,
  invalidParameter,
  ok,
  type Argon2Params,
  type CryptoResult,
} from "@kunjae/core-crypto";

export const MIN_EXPORT_PASSWORD_LENGTH = 12;

const EXPORT_SALT_BYTES = 32;

export type EncryptedExport = {
  readonly format: "kunjae.export.encrypted";
  readonly version: 1;
  readonly kdf: { readonly name: "argon2id" } & Argon2Params;
  readonly saltBase64Url: string;
  readonly nonceBase64Url: string;
  readonly ciphertextBase64Url: string;
  readonly warning: string;
};

export const encryptExport = async (
  plaintext: string,
  password: string,
  lang: MessageLang = "en",
): Promise<CryptoResult<EncryptedExport>> => {
  if (password.length < MIN_EXPORT_PASSWORD_LENGTH) {
    return err(invalidParameter("password"));
  }

  const salt = randomBytes(EXPORT_SALT_BYTES);
  if (!salt.ok) return salt;

  const passwordBytes = utf8ToBytes(password);
  if (!passwordBytes.ok) return passwordBytes;

  try {
    const derived = await deriveKeyFromPassword(passwordBytes.value, salt.value, ARGON2_PARAMS_V1);
    if (!derived.ok) return derived;

    try {
      const key = await importAeadKey(derived.value);
      if (!key.ok) return key;

      const content = utf8ToBytes(plaintext);
      if (!content.ok) return content;

      const sealed = await aeadSeal(key.value, content.value, EMPTY_AAD);
      wipe(content.value);
      if (!sealed.ok) return sealed;

      return ok({
        format: "kunjae.export.encrypted",
        version: 1,
        kdf: { name: "argon2id", ...ARGON2_PARAMS_V1 },
        saltBase64Url: bytesToBase64Url(salt.value),
        nonceBase64Url: bytesToBase64Url(sealed.value.nonce),
        ciphertextBase64Url: bytesToBase64Url(sealed.value.ciphertext),
        warning: ENCRYPTED_EXPORT_WARNING[lang],
      });
    } finally {
      wipe(derived.value);
    }
  } finally {
    wipe(passwordBytes.value);
  }
};

export const decryptExport = async (
  document: string,
  password: string,
): Promise<CryptoResult<string>> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(document);
  } catch {
    return err(invalidFormat("encrypted-export"));
  }

  if (typeof parsed !== "object" || parsed === null) {
    return err(invalidFormat("encrypted-export"));
  }

  const record = parsed as Record<string, unknown>;
  if (record["format"] !== "kunjae.export.encrypted" || record["version"] !== 1) {
    return err(invalidFormat("encrypted-export"));
  }

  const kdf = record["kdf"];
  if (typeof kdf !== "object" || kdf === null) {
    return err(invalidFormat("encrypted-export"));
  }

  const kdfRecord = kdf as Record<string, unknown>;
  if (kdfRecord["name"] !== "argon2id") {
    return err(invalidFormat("encrypted-export"));
  }

  const params: Argon2Params = {
    memoryKiB: Number(kdfRecord["memoryKiB"]),
    iterations: Number(kdfRecord["iterations"]),
    parallelism: Number(kdfRecord["parallelism"]),
    hashLength: Number(kdfRecord["hashLength"]),
  };

  if (!validateArgon2Params(params).ok) {
    return err(invalidFormat("encrypted-export"));
  }

  const textField = (name: string): string | null => {
    const value = record[name];
    return typeof value === "string" ? value : null;
  };

  const saltText = textField("saltBase64Url");
  const nonceText = textField("nonceBase64Url");
  const ciphertextText = textField("ciphertextBase64Url");
  if (saltText === null || nonceText === null || ciphertextText === null) {
    return err(invalidFormat("encrypted-export"));
  }

  const salt = base64UrlToBytes(saltText);
  const nonce = base64UrlToBytes(nonceText);
  const ciphertext = base64UrlToBytes(ciphertextText);
  if (!salt.ok) return salt;
  if (!nonce.ok) return nonce;
  if (!ciphertext.ok) return ciphertext;

  const passwordBytes = utf8ToBytes(password);
  if (!passwordBytes.ok) return passwordBytes;

  try {
    const derived = await deriveKeyFromPassword(passwordBytes.value, salt.value, params);
    if (!derived.ok) return derived;

    try {
      const key = await importAeadKey(derived.value);
      if (!key.ok) return key;

      const opened = await aeadOpen(
        key.value,
        { nonce: nonce.value, ciphertext: ciphertext.value },
        EMPTY_AAD,
      );
      if (!opened.ok) return opened;

      try {
        return bytesToUtf8(opened.value);
      } finally {
        wipe(opened.value);
      }
    } finally {
      wipe(derived.value);
    }
  } finally {
    wipe(passwordBytes.value);
  }
};

export type ImportResult = {
  readonly added: number;
  readonly skipped: number;
  readonly invalid: number;
  readonly failed: number;
};

export type ImportParams = {
  readonly document: string;
  readonly password: string;
  readonly vaultId: string;
  readonly nowMs: number;
};

const FIELD_SEPARATOR = String.fromCharCode(0);

const fingerprintOf = (content: ItemContent): string => {
  const username = content.type === "login" ? content.username : "";
  const password = content.type === "login" ? content.password : "";

  return [content.type, content.title, username, password].join(FIELD_SEPARATOR);
};

export const importVaultExport = async (
  params: ImportParams,
): Promise<AppResult<ImportResult>> => {
  let plain = params.document;

  if (params.document.includes("kunjae.export.encrypted")) {
    const opened = await decryptExport(params.document, params.password);
    if (!opened.ok) return err(invalidInput("exportPassword"));
    plain = opened.value;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(plain);
  } catch {
    return err(invalidInput("exportFile"));
  }

  if (typeof parsed !== "object" || parsed === null) return err(invalidInput("exportFile"));

  const record = parsed as Record<string, unknown>;
  if (record["format"] !== "kunjae.export") return err(invalidInput("exportFile"));

  const rawItems = record["items"];
  if (!Array.isArray(rawItems)) return err(invalidInput("exportFile"));

  const existing = new Set(readAllItems().map((item) => fingerprintOf(item.content)));

  let added = 0;
  let skipped = 0;
  let invalid = 0;
  let failed = 0;

  for (const raw of rawItems) {
    if (typeof raw !== "object" || raw === null) {
      invalid += 1;
      continue;
    }

    const candidate: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
    delete candidate["itemId"];
    delete candidate["vault"];

    const validated = ItemContentSchema.safeParse(candidate);
    if (!validated.success) {
      invalid += 1;
      continue;
    }

    const fingerprint = fingerprintOf(validated.data);
    if (existing.has(fingerprint)) {
      skipped += 1;
      continue;
    }

    const newId = createUlid(params.nowMs + added);
    if (!newId.ok) {
      failed += 1;
      continue;
    }

    const saved = await saveItem({
      itemId: newId.value,
      vaultId: params.vaultId,
      content: validated.data,
      baseVersion: 0,
      nowMs: params.nowMs,
    });

    if (!saved.ok) {
      failed += 1;
      continue;
    }

    existing.add(fingerprint);
    added += 1;
  }

  return ok({ added, skipped, invalid, failed });
};
