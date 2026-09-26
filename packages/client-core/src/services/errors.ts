import type { Result } from "@kunjae/core-crypto";

import { lockSession } from "../session/vault-session.ts";

export type AppError =
  | { readonly kind: "WrongCredentials" }
  | { readonly kind: "EmailTaken" }
  | { readonly kind: "MalformedSecretKey" }
  | { readonly kind: "InvalidInput"; readonly field: string; readonly minLength?: number }
  | { readonly kind: "Offline" }
  | { readonly kind: "SessionExpired" }
  | { readonly kind: "UntrustedServer" }
  | { readonly kind: "Conflict" }
  | { readonly kind: "WrongDevicePassword" }
  | { readonly kind: "LocalVaultExists" }
  | { readonly kind: "LocalVaultMissing" }
  | { readonly kind: "LocalVaultCorrupt" }
  | { readonly kind: "LocalStorageFailed" }
  | { readonly kind: "AccountRequired" }
  | { readonly kind: "Unexpected" };

export type AppResult<T> = Result<T, AppError>;

export const wrongCredentials = (): AppError => ({ kind: "WrongCredentials" });
export const emailTaken = (): AppError => ({ kind: "EmailTaken" });
export const malformedSecretKey = (): AppError => ({ kind: "MalformedSecretKey" });
export const invalidInput = (field: string, minLength?: number): AppError =>
  minLength === undefined ? { kind: "InvalidInput", field } : { kind: "InvalidInput", field, minLength };
export const offline = (): AppError => ({ kind: "Offline" });
export const sessionExpired = (): AppError => ({ kind: "SessionExpired" });
export const untrustedServer = (): AppError => ({ kind: "UntrustedServer" });
export const conflict = (): AppError => ({ kind: "Conflict" });
export const wrongDevicePassword = (): AppError => ({ kind: "WrongDevicePassword" });
export const localVaultExists = (): AppError => ({ kind: "LocalVaultExists" });
export const localVaultMissing = (): AppError => ({ kind: "LocalVaultMissing" });
export const localVaultCorrupt = (): AppError => ({ kind: "LocalVaultCorrupt" });
export const localStorageFailed = (): AppError => ({ kind: "LocalStorageFailed" });
export const accountRequired = (): AppError => ({ kind: "AccountRequired" });
export const unexpected = (): AppError => ({ kind: "Unexpected" });

export const fromApiError = (error: { readonly kind: string; readonly code?: string }): AppError => {
  if (error.kind === "NetworkUnavailable" || error.kind === "RequestTimedOut") return offline();
  if (error.kind === "InvalidResponse") return untrustedServer();

  switch (error.code) {
    case "INVALID_CREDENTIALS":
      return wrongCredentials();
    case "UNAUTHORIZED":
      return sessionExpired();
    case "CONFLICT":
      return emailTaken();
    default:
      return unexpected();
  }
};

export const lockIfSessionExpired = (error: AppError): AppError => {
  if (error.kind === "SessionExpired") lockSession();
  return error;
};

export type MessageLang = "en" | "th";

const FIELD_LABELS: Readonly<Record<string, Readonly<Record<MessageLang, string>>>> = {
  masterPassword: { en: "Master Password", th: "รหัสผ่านหลัก" },
  newMasterPassword: { en: "new Master Password", th: "รหัสผ่านใหม่" },
  deviceMasterPassword: { en: "device Master Password", th: "Master Password ของเครื่องนี้" },
  newDeviceMasterPassword: { en: "new device Master Password", th: "Master Password ใหม่ของเครื่องนี้" },
  exportPassword: { en: "file password", th: "รหัสผ่านของไฟล์" },
  exportFile: { en: "export file", th: "ไฟล์ส่งออก" },
};

const fieldLabel = (field: string, lang: MessageLang): string => FIELD_LABELS[field]?.[lang] ?? field;

const invalidInputMessage = (field: string, minLength: number | undefined, lang: MessageLang): string => {
  const label = fieldLabel(field, lang);
  if (lang === "th") {
    return minLength === undefined
      ? `ข้อมูลในช่อง ${label} ยังไม่ถูกต้อง`
      : `ข้อมูลในช่อง ${label} (อย่างน้อย ${String(minLength)} ตัวอักษร) ยังไม่ถูกต้อง`;
  }
  return minLength === undefined
    ? `The ${label} is not valid.`
    : `The ${label} must be at least ${String(minLength)} characters.`;
};

const MESSAGES: Readonly<Record<MessageLang, Readonly<Record<Exclude<AppError["kind"], "InvalidInput">, string>>>> = {
  en: {
    WrongCredentials: "Incorrect Master Password or Secret Key.",
    EmailTaken: "This email is already registered.",
    MalformedSecretKey: "Invalid Secret Key format — it must start with K1 and have 26 characters.",
    Offline: "Can't reach the server — anything already open still works as usual.",
    SessionExpired: "Your session has expired. Please unlock again.",
    UntrustedServer: "The server sent an invalid response — stopped for your safety.",
    Conflict: "This item was changed on another device — the latest version has been loaded. Please review it before saving again.",
    WrongDevicePassword: "Incorrect device Master Password.",
    LocalVaultExists: "There's already a vault on this device.",
    LocalVaultMissing: "There's no vault on this device.",
    LocalVaultCorrupt: "The vault saved on this device is damaged and can't be opened.",
    LocalStorageFailed: "Couldn't save to this device's storage — your latest change wasn't saved.",
    AccountRequired: "This needs a Kunjae account — sign in first.",
    Unexpected: "Something unexpected went wrong.",
  },
  th: {
    WrongCredentials: "รหัสผ่านหลักหรือ Secret Key ไม่ถูกต้อง",
    EmailTaken: "อีเมลนี้ถูกใช้สมัครไปแล้ว",
    MalformedSecretKey: "รูปแบบ Secret Key ไม่ถูกต้อง — ต้องขึ้นต้นด้วย K1 และมี 26 อักขระ",
    Offline: "ติดต่อเซิร์ฟเวอร์ไม่ได้ — ข้อมูลที่เปิดอยู่ยังใช้งานได้ตามปกติ",
    SessionExpired: "เซสชันหมดอายุ กรุณาปลดล็อกใหม่",
    UntrustedServer: "เซิร์ฟเวอร์ตอบกลับด้วยข้อมูลที่ไม่ถูกต้อง — หยุดการทำงานเพื่อความปลอดภัย",
    Conflict: "มีการแก้ไขรายการนี้จากอีกเครื่องหนึ่ง — ดึงข้อมูลล่าสุดมาแล้ว กรุณาตรวจสอบก่อนบันทึกซ้ำ",
    WrongDevicePassword: "Master Password ของเครื่องนี้ไม่ถูกต้อง",
    LocalVaultExists: "มีตู้นิรภัยบนเครื่องนี้อยู่แล้ว",
    LocalVaultMissing: "ไม่พบตู้นิรภัยบนเครื่องนี้",
    LocalVaultCorrupt: "ข้อมูลตู้นิรภัยที่เก็บบนเครื่องนี้เสียหาย จึงเปิดไม่ได้",
    LocalStorageFailed: "บันทึกลงพื้นที่เก็บข้อมูลของเครื่องนี้ไม่สำเร็จ — การแก้ไขล่าสุดยังไม่ถูกบันทึก",
    AccountRequired: "ต้องใช้บัญชี Kunjae — กรุณาเข้าสู่ระบบก่อน",
    Unexpected: "เกิดข้อผิดพลาดที่ไม่คาดคิด",
  },
};

export const errorMessage = (error: AppError, lang: MessageLang = "en"): string =>
  error.kind === "InvalidInput"
    ? invalidInputMessage(error.field, error.minLength, lang)
    : MESSAGES[lang][error.kind];
