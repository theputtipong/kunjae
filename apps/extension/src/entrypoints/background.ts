import {
  clearStore,
  configureApi,
  createUlid,
  getDefaultVaultId,
  getItemContent,
  getItemRef,
  getSessionView,
  getStoreView,
  lockSession,
  pull,
  saveItem,
  signUp,
  subscribeToSession,
  unlock,
} from "@kunjae/client-core";
import { emptyLoginItem } from "@kunjae/domain";
import { browser, defineBackground } from "#imports";

import { totpFromSecretText } from "@kunjae/core-crypto";

import { apiBaseUrl } from "../config.ts";
import { decideFill, hostOf } from "../origin.ts";
import { fillCredentials, fillOtpCode } from "../fill-form.ts";
import { RequestSchema, type ItemBrief, type Response } from "../messaging.ts";

const listItems = (): readonly ItemBrief[] =>
  getStoreView()
    .items.filter((item) => item.type === "login")
    .map((item) => {
      const content = getItemContent(item.itemId);
      const url = content?.type === "login" ? content.urls[0] : undefined;

      return {
        itemId: item.itemId,
        title: item.title,
        username: item.subtitle,
        host: hostOf(url),
        hasTotp: content?.type === "login" && content.totpSecret !== "",
      };
    });

const handleFill = async (itemId: string): Promise<Response> => {
  const content = getItemContent(itemId);
  if (content?.type !== "login") return { ok: false, message: "ไม่พบรายการนี้" };

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return { ok: false, message: "ไม่พบหน้าเว็บที่เปิดอยู่" };

  const decision = decideFill(tab.url, content.urls[0]);

  if (!decision.allowed) {
    switch (decision.reason) {
      case "no-saved-url":
        return { ok: false, message: "รายการนี้ไม่ได้บันทึกที่อยู่เว็บไว้ จึงเติมให้ไม่ได้" };
      case "unsupported-page":
        return { ok: false, message: "หน้านี้ไม่ใช่หน้าเว็บปกติ จึงเติมให้ไม่ได้" };
      case "no-tab-access":
        return {
          ok: false,
          message: "ยังไม่ได้รับสิทธิ์อ่านหน้านี้ — เปิด Kunjae จากไอคอนบนแถบเครื่องมือแล้วลองใหม่",
        };
      case "origin-mismatch":
        return {
          ok: false,
          message: `ที่อยู่ของหน้านี้ (${decision.tabOrigin}) ไม่ตรงกับที่บันทึกไว้ (${decision.savedOrigin})`,
        };
    }
  }

  let results: { readonly result?: unknown }[];
  try {
    results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillCredentials,
      args: [content.username, content.password],
    });
  } catch {
    return {
      ok: false,
      message: "เข้าถึงหน้านี้ไม่ได้ — เปิด Kunjae จากไอคอนบนแถบเครื่องมือแล้วลองใหม่",
    };
  }

  const filled = results[0]?.result === true;
  return filled ? { ok: true, kind: "done" } : { ok: false, message: "ไม่พบช่องรหัสผ่านในหน้านี้" };
};

const handleFillTotp = async (itemId: string): Promise<Response> => {
  const content = getItemContent(itemId);
  if (content?.type !== "login" || content.totpSecret === "") {
    return { ok: false, message: "รายการนี้ไม่ได้ตั้งรหัสผ่านครั้งเดียวไว้" };
  }

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return { ok: false, message: "ไม่พบหน้าเว็บที่เปิดอยู่" };

  const decision = decideFill(tab.url, content.urls[0]);
  if (!decision.allowed) {
    return {
      ok: false,
      message:
        decision.reason === "origin-mismatch"
          ? `ที่อยู่ของหน้านี้ (${decision.tabOrigin}) ไม่ตรงกับที่บันทึกไว้ (${decision.savedOrigin})`
          : "เติมรหัสในหน้านี้ไม่ได้",
    };
  }

  const computed = totpFromSecretText(content.totpSecret, Date.now());
  if (!computed.ok) return { ok: false, message: "ความลับ TOTP อ่านไม่ได้" };

  let results: { readonly result?: unknown }[];
  try {
    results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillOtpCode,
      args: [computed.value.code],
    });
  } catch {
    return {
      ok: false,
      message: "เข้าถึงหน้านี้ไม่ได้ — เปิด Kunjae จากไอคอนบนแถบเครื่องมือแล้วลองใหม่",
    };
  }

  return results[0]?.result === true
    ? { ok: true, kind: "done" }
    : {
        ok: false,
        message: "หน้านี้ไม่ได้ประกาศช่องรหัส 2FA ตามมาตรฐาน — กดคัดลอกแล้ววางเองได้",
      };
};

let toolbarTheme: "light" | "dark" = "light";

const updateActionIcon = (): void => {
  const state = getSessionView().status === "unlocked" ? "unlocked" : "locked";
  void browser.action.setIcon({
    path: {
      16: `/action/${state}-${toolbarTheme}-16.png`,
      32: `/action/${state}-${toolbarTheme}-32.png`,
    },
  });
  void browser.action.setTitle({ title: state === "unlocked" ? "Kunjae — ปลดล็อกอยู่" : "Kunjae — ล็อกอยู่" });
};

const handle = async (request: unknown): Promise<Response> => {
  const parsed = RequestSchema.safeParse(request);
  if (!parsed.success) return { ok: false, message: "คำขอไม่ถูกต้อง" };

  switch (parsed.data.kind) {
    case "status": {
      if (parsed.data.theme !== undefined && parsed.data.theme !== toolbarTheme) {
        toolbarTheme = parsed.data.theme;
        updateActionIcon();
      }
      const view = getSessionView();
      return { ok: true, kind: "status", unlocked: view.status === "unlocked", email: view.email };
    }

    case "unlock": {
      const result = await unlock({
        email: parsed.data.email,
        masterPassword: parsed.data.masterPassword,
        secretKeyText: parsed.data.secretKeyText,
        nowMs: Date.now(),
      });
      if (!result.ok) return { ok: false, message: "ปลดล็อกไม่สำเร็จ — ตรวจสอบรหัสผ่านและ Secret Key" };

      const pulled = await pull(Date.now());
      if (!pulled.ok) return { ok: false, message: "ปลดล็อกได้แต่ดึงข้อมูลไม่สำเร็จ" };

      return { ok: true, kind: "done" };
    }

    case "sign-up": {
      const created = await signUp({
        email: parsed.data.email,
        masterPassword: parsed.data.masterPassword,
        nowMs: Date.now(),
      });
      if (!created.ok) return { ok: false, message: "สมัครสมาชิกไม่สำเร็จ — อีเมลนี้อาจถูกใช้แล้ว" };

      await pull(Date.now());

      return {
        ok: true,
        kind: "emergency-kit",
        email: created.value.email,
        secretKey: created.value.secretKey,
      };
    }

    case "lock": {
      lockSession();
      clearStore();
      return { ok: true, kind: "done" };
    }

    case "list":
      return { ok: true, kind: "list", items: listItems() };

    case "reveal": {
      const content = getItemContent(parsed.data.itemId);
      if (content?.type !== "login") return { ok: false, message: "ไม่พบรายการนี้" };
      return { ok: true, kind: "reveal", password: content.password };
    }

    case "totp": {
      const content = getItemContent(parsed.data.itemId);
      if (content?.type !== "login" || content.totpSecret === "") {
        return { ok: false, message: "รายการนี้ไม่ได้ตั้งรหัสผ่านครั้งเดียวไว้" };
      }

      const result = totpFromSecretText(content.totpSecret, Date.now());
      if (!result.ok) return { ok: false, message: "ความลับ TOTP อ่านไม่ได้" };

      return {
        ok: true,
        kind: "totp",
        code: result.value.code,
        secondsRemaining: result.value.secondsRemaining,
      };
    }

    case "load-for-edit": {
      const content = getItemContent(parsed.data.itemId);
      if (content?.type !== "login") return { ok: false, message: "แก้ไขรายการประเภทนี้จากส่วนขยายไม่ได้" };

      return {
        ok: true,
        kind: "editable",
        title: content.title,
        username: content.username,
        password: content.password,
        url: content.urls[0] ?? "",
        totpSecret: content.totpSecret,
      };
    }

    case "save":
      return handleSave(parsed.data);

    case "fill":
      return handleFill(parsed.data.itemId);

    case "fill-totp":
      return handleFillTotp(parsed.data.itemId);
  }
};

const handleSave = async (params: {
  readonly itemId: string | null;
  readonly title: string;
  readonly username: string;
  readonly password: string;
  readonly url: string;
  readonly totpSecret: string;
}): Promise<Response> => {
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();

  const existingRef = params.itemId === null ? null : getItemRef(params.itemId);
  const existing = params.itemId === null ? null : getItemContent(params.itemId);

  if (params.itemId !== null && (existingRef === null || existing?.type !== "login")) {
    return { ok: false, message: "ไม่พบรายการนี้" };
  }

  const base = existing?.type === "login" ? existing : emptyLoginItem(params.title, now);

  const content = {
    ...base,
    title: params.title,
    username: params.username,
    password: params.password,
    urls: params.url === "" ? [] : [params.url],
    totpSecret: params.totpSecret,
    updatedAt: now,
  };

  const vaultId = existingRef?.vaultId ?? getDefaultVaultId();
  if (vaultId === null) return { ok: false, message: "ยังไม่มี vault ให้บันทึก" };

  const itemId = params.itemId ?? (() => {
    const generated = createUlid(nowMs);
    return generated.ok ? generated.value : null;
  })();
  if (itemId === null) return { ok: false, message: "สร้างรหัสรายการไม่สำเร็จ" };

  const saved = await saveItem({
    itemId,
    vaultId,
    content,
    baseVersion: existingRef?.version ?? 0,
    nowMs,
  });

  if (!saved.ok) return { ok: false, message: "บันทึกไม่สำเร็จ — อาจมีเครื่องอื่นแก้รายการนี้ไปแล้ว" };

  return { ok: true, kind: "done" };
};

export default defineBackground(() => {
  const configured = configureApi(apiBaseUrl());
  if (!configured.ok) throw new Error("ที่อยู่ API ไม่ถูกต้อง");

  updateActionIcon();
  subscribeToSession(updateActionIcon);

  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    handle(message).then(sendResponse, () => {
      sendResponse({ ok: false, message: "เกิดข้อผิดพลาดภายใน" } satisfies Response);
    });

    return true;
  });
});
