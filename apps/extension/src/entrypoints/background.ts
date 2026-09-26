import {
  changeLocalPassword,
  clearStore,
  configureApi,
  configureLocalPersistence,
  createIndexedDbPersistence,
  createLocalVault,
  createUlid,
  deleteLocalVault,
  getDefaultVaultId,
  getItemContent,
  getItemRef,
  getLocalVaultSummary,
  getSessionView,
  getStoreView,
  hasLocalVault,
  lockSession,
  migrateLocalToAccount,
  pull,
  saveItem,
  signUp,
  subscribeToSession,
  unlock,
  unlockLocal,
  type AppError,
} from "@kunjae/client-core";
import { emptyLoginItem } from "@kunjae/domain";
import { browser, defineBackground } from "#imports";

import { totpFromSecretText } from "@kunjae/core-crypto";

import { apiBaseUrl } from "../config.ts";
import { decideFill, hostOf } from "../origin.ts";
import { fillCredentials, fillOtpCode } from "../fill-form.ts";
import {
  RequestSchema,
  type ErrorCode,
  type ItemBrief,
  type LocalBrief,
  type Response,
} from "../messaging.ts";
import { dictionary, resolveLang } from "../i18n.ts";

const fail = (error: ErrorCode): Response => ({ ok: false, error });

const codeFor = (error: AppError, fallback: ErrorCode): ErrorCode => {
  switch (error.kind) {
    case "WrongDevicePassword":
      return "wrong-device-password";
    case "LocalVaultExists":
      return "local-vault-exists";
    case "LocalVaultMissing":
      return "local-vault-missing";
    case "LocalVaultCorrupt":
      return "local-vault-corrupt";
    case "LocalStorageFailed":
      return "local-storage-failed";
    case "AccountRequired":
      return "account-required";
    case "SessionExpired":
      return "session-expired";
    case "Offline":
      return "offline";
    default:
      return fallback;
  }
};

let migrationDismissed = false;

const localBrief = async (): Promise<LocalBrief> => {
  const exists = await hasLocalVault();
  if (!exists) return { exists, itemCount: null, offerMigration: false };

  const summary = await getLocalVaultSummary();
  const itemCount = summary.ok ? (summary.value?.itemCount ?? null) : null;

  return {
    exists,
    itemCount,
    offerMigration:
      getSessionView().mode === "account" && !migrationDismissed && itemCount !== null && itemCount > 0,
  };
};

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
  if (content?.type !== "login") return fail("item-not-found");

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return fail("no-active-tab");

  const decision = decideFill(tab.url, content.urls[0]);

  if (!decision.allowed) {
    switch (decision.reason) {
      case "no-saved-url":
        return fail("no-saved-url");
      case "unsupported-page":
        return fail("unsupported-page");
      case "no-tab-access":
        return fail("no-tab-access");
      case "origin-mismatch":
        return {
          ok: false,
          error: "origin-mismatch",
          tabOrigin: decision.tabOrigin,
          savedOrigin: decision.savedOrigin,
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
    return fail("page-inaccessible");
  }

  const filled = results[0]?.result === true;
  return filled ? { ok: true, kind: "done" } : fail("no-password-field");
};

const handleFillTotp = async (itemId: string): Promise<Response> => {
  const content = getItemContent(itemId);
  if (content?.type !== "login" || content.totpSecret === "") {
    return fail("no-totp");
  }

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return fail("no-active-tab");

  const decision = decideFill(tab.url, content.urls[0]);
  if (!decision.allowed) {
    return decision.reason === "origin-mismatch"
      ? {
          ok: false,
          error: "origin-mismatch",
          tabOrigin: decision.tabOrigin,
          savedOrigin: decision.savedOrigin,
        }
      : fail("totp-fill-unavailable");
  }

  const computed = totpFromSecretText(content.totpSecret, Date.now());
  if (!computed.ok) return fail("totp-unreadable");

  let results: { readonly result?: unknown }[];
  try {
    results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillOtpCode,
      args: [computed.value.code],
    });
  } catch {
    return fail("page-inaccessible");
  }

  return results[0]?.result === true
    ? { ok: true, kind: "done" }
    : fail("no-otp-field");
};

let toolbarTheme: "light" | "dark" = "light";

const updateActionIcon = (): void => {
  const t = dictionary();
  const view = getSessionView();
  const state = view.status === "unlocked" ? "unlocked" : "locked";
  void browser.action.setIcon({
    path: {
      16: `/action/${state}-${toolbarTheme}-16.png`,
      32: `/action/${state}-${toolbarTheme}-32.png`,
    },
  });
  const title =
    state === "locked" ? t.actionLocked : view.mode === "local" ? t.actionUnlockedLocal : t.actionUnlocked;
  void browser.action.setTitle({ title });
};

const handle = async (request: unknown): Promise<Response> => {
  const parsed = RequestSchema.safeParse(request);
  if (!parsed.success) return fail("invalid-request");

  switch (parsed.data.kind) {
    case "status": {
      if (parsed.data.theme !== undefined && parsed.data.theme !== toolbarTheme) {
        toolbarTheme = parsed.data.theme;
        updateActionIcon();
      }
      const local = await localBrief();
      const view = getSessionView();
      return {
        ok: true,
        kind: "status",
        unlocked: view.status === "unlocked",
        mode: view.mode,
        email: view.email,
        local,
      };
    }

    case "local-status":
      return { ok: true, kind: "local-status", local: await localBrief() };

    case "local-create": {
      const created = await createLocalVault({
        masterPassword: parsed.data.masterPassword,
        lang: resolveLang(),
      });
      return created.ok ? { ok: true, kind: "done" } : fail(codeFor(created.error, "internal"));
    }

    case "local-unlock": {
      const opened = await unlockLocal({ masterPassword: parsed.data.masterPassword });
      return opened.ok ? { ok: true, kind: "done" } : fail(codeFor(opened.error, "internal"));
    }

    case "local-change-password": {
      const changed = await changeLocalPassword({
        current: parsed.data.current,
        next: parsed.data.next,
      });
      return changed.ok ? { ok: true, kind: "done" } : fail(codeFor(changed.error, "internal"));
    }

    case "local-delete": {
      const deleted = await deleteLocalVault();
      return deleted.ok ? { ok: true, kind: "done" } : fail(codeFor(deleted.error, "internal"));
    }

    case "local-migrate": {
      const migrated = await migrateLocalToAccount({
        devicePassword: parsed.data.devicePassword,
        nowMs: Date.now(),
      });
      if (!migrated.ok) return fail(codeFor(migrated.error, "internal"));

      return { ok: true, kind: "migrated", ...migrated.value };
    }

    case "local-dismiss-migration": {
      migrationDismissed = true;
      return { ok: true, kind: "done" };
    }

    case "unlock": {
      const result = await unlock({
        email: parsed.data.email,
        masterPassword: parsed.data.masterPassword,
        secretKeyText: parsed.data.secretKeyText,
        nowMs: Date.now(),
      });
      if (!result.ok) return fail(result.error.kind === "Offline" ? "offline" : "unlock-failed");

      clearStore();
      migrationDismissed = false;

      const pulled = await pull(Date.now());
      if (!pulled.ok) return fail("sync-failed");

      return { ok: true, kind: "done" };
    }

    case "sign-up": {
      const created = await signUp({
        email: parsed.data.email,
        masterPassword: parsed.data.masterPassword,
        nowMs: Date.now(),
      });
      if (!created.ok) return fail("sign-up-failed");

      clearStore();
      migrationDismissed = false;
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
      if (content?.type !== "login") return fail("item-not-found");
      return { ok: true, kind: "reveal", password: content.password };
    }

    case "totp": {
      const content = getItemContent(parsed.data.itemId);
      if (content?.type !== "login" || content.totpSecret === "") {
        return fail("no-totp");
      }

      const result = totpFromSecretText(content.totpSecret, Date.now());
      if (!result.ok) return fail("totp-unreadable");

      return {
        ok: true,
        kind: "totp",
        code: result.value.code,
        secondsRemaining: result.value.secondsRemaining,
      };
    }

    case "load-for-edit": {
      const content = getItemContent(parsed.data.itemId);
      if (content?.type !== "login") return fail("edit-unsupported");

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
    return fail("item-not-found");
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
  if (vaultId === null) return fail("no-vault");

  const itemId = params.itemId ?? (() => {
    const generated = createUlid(nowMs);
    return generated.ok ? generated.value : null;
  })();
  if (itemId === null) return fail("id-failed");

  const saved = await saveItem({
    itemId,
    vaultId,
    content,
    baseVersion: existingRef?.version ?? 0,
    nowMs,
  });

  if (!saved.ok) return fail(codeFor(saved.error, "save-conflict"));

  return { ok: true, kind: "done" };
};

export default defineBackground(() => {
  const configured = configureApi(apiBaseUrl());
  if (!configured.ok) throw new Error("Invalid API base URL");

  // eslint-disable-next-line no-restricted-globals
  configureLocalPersistence(createIndexedDbPersistence(indexedDB));

  updateActionIcon();
  subscribeToSession(updateActionIcon);

  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === "install") {
      void browser.tabs.create({ url: browser.runtime.getURL("/signup.html?mode=welcome") });
    }
  });

  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    handle(message).then(sendResponse, () => {
      sendResponse(fail("internal"));
    });

    return true;
  });
});
