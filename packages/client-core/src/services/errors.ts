import type { Result } from "@kunjae/core-crypto";

import { lockSession } from "../session/vault-session.ts";

export type AppError =
  | { readonly kind: "WrongCredentials" }
  | { readonly kind: "EmailTaken" }
  | { readonly kind: "MalformedSecretKey" }
  | { readonly kind: "InvalidInput"; readonly field: string }
  | { readonly kind: "Offline" }
  | { readonly kind: "SessionExpired" }
  | { readonly kind: "UntrustedServer" }
  | { readonly kind: "Conflict" }
  | { readonly kind: "Unexpected" };

export type AppResult<T> = Result<T, AppError>;

export const wrongCredentials = (): AppError => ({ kind: "WrongCredentials" });
export const emailTaken = (): AppError => ({ kind: "EmailTaken" });
export const malformedSecretKey = (): AppError => ({ kind: "MalformedSecretKey" });
export const invalidInput = (field: string): AppError => ({ kind: "InvalidInput", field });
export const offline = (): AppError => ({ kind: "Offline" });
export const sessionExpired = (): AppError => ({ kind: "SessionExpired" });
export const untrustedServer = (): AppError => ({ kind: "UntrustedServer" });
export const conflict = (): AppError => ({ kind: "Conflict" });
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

export const errorMessage = (error: AppError): string => {
  switch (error.kind) {
    case "WrongCredentials":
      return "รหัสผ่านหลักหรือ Secret Key ไม่ถูกต้อง";
    case "EmailTaken":
      return "อีเมลนี้ถูกใช้สมัครไปแล้ว";
    case "MalformedSecretKey":
      return "รูปแบบ Secret Key ไม่ถูกต้อง — ต้องขึ้นต้นด้วย K1 และมี 26 อักขระ";
    case "InvalidInput":
      return `ข้อมูลในช่อง ${error.field} ยังไม่ถูกต้อง`;
    case "Offline":
      return "ติดต่อเซิร์ฟเวอร์ไม่ได้ — ข้อมูลที่เปิดอยู่ยังใช้งานได้ตามปกติ";
    case "SessionExpired":
      return "เซสชันหมดอายุ กรุณาปลดล็อกใหม่";
    case "UntrustedServer":
      return "เซิร์ฟเวอร์ตอบกลับด้วยข้อมูลที่ไม่ถูกต้อง — หยุดการทำงานเพื่อความปลอดภัย";
    case "Conflict":
      return "มีการแก้ไขรายการนี้จากอีกเครื่องหนึ่ง — ดึงข้อมูลล่าสุดมาแล้ว กรุณาตรวจสอบก่อนบันทึกซ้ำ";
    case "Unexpected":
      return "เกิดข้อผิดพลาดที่ไม่คาดคิด";
  }
};
