import { useEffect, useState } from "react";

import { clearDeferredInstall, getDeferredInstall, onInstallAvailabilityChange } from "../pwa.ts";
import { KunjaeMark } from "./kunjae-mark.tsx";

const ANDROID_PACKAGE = "com.kunjae.app";
const DISMISSED_KEY = "kunjae.install-prompt.dismissed-at";
const REPROMPT_MS = 24 * 60 * 60 * 1000;

type Kind = "android-store" | "android-pwa" | "ios-pwa" | "desktop-extension";

type RelatedApp = { readonly platform: string; readonly id?: string };
type NavigatorWithApps = Navigator & {
  getInstalledRelatedApps?: () => Promise<readonly RelatedApp[]>;
  standalone?: boolean;
};

const envUrl = (name: string): string | null => {
  const value: unknown = import.meta.env[name];
  return typeof value === "string" && value.startsWith("https://") ? value : null;
};

const PLAY_STORE_URL = envUrl("VITE_PLAY_STORE_URL");
const CHROME_WEB_STORE_URL = envUrl("VITE_CHROME_WEB_STORE_URL");

const readStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return;
  }
};

const isStandalone = (): boolean =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as NavigatorWithApps).standalone === true;

const recentlyDismissed = (): boolean => {
  const at = Number(readStorage(DISMISSED_KEY));
  return Number.isFinite(at) && at > 0 && Date.now() - at < REPROMPT_MS;
};

const platformOf = (): "android" | "ios" | "desktop-chromium" | "other" => {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/chrome|chromium|edg\//i.test(ua) && !/mobile/i.test(ua)) return "desktop-chromium";
  return "other";
};

const androidAppInstalled = async (): Promise<boolean> => {
  const nav = navigator as NavigatorWithApps;
  if (nav.getInstalledRelatedApps === undefined) return false;
  try {
    const apps = await nav.getInstalledRelatedApps();
    return apps.some((app) => app.id === ANDROID_PACKAGE);
  } catch {
    return false;
  }
};

const decide = async (): Promise<Kind | null> => {
  if (isStandalone() || recentlyDismissed()) return null;

  switch (platformOf()) {
    case "android":
      if (await androidAppInstalled()) return null;
      if (PLAY_STORE_URL !== null) return "android-store";
      return getDeferredInstall() === null ? null : "android-pwa";
    case "ios":
      return "ios-pwa";
    case "desktop-chromium":
      return CHROME_WEB_STORE_URL === null ? null : "desktop-extension";
    case "other":
      return null;
  }
};

const COPY: Record<Kind, { readonly title: string; readonly body: string; readonly action: string | null }> = {
  "android-store": {
    title: "ใช้ Kunjae บนมือถือ",
    body: "แอป Android ปลดล็อกด้วยลายนิ้วมือ และเติมรหัสผ่านให้แอปอื่นได้",
    action: "ดาวน์โหลดจาก Google Play",
  },
  "android-pwa": {
    title: "ติดตั้ง Kunjae",
    body: "เพิ่มลงหน้าจอโฮม เปิดได้เหมือนแอป",
    action: "ติดตั้ง",
  },
  "ios-pwa": {
    title: "เพิ่ม Kunjae ลงหน้าจอโฮม",
    body: "แตะปุ่มแชร์ ⎋ ใน Safari แล้วเลือก \"เพิ่มไปยังหน้าจอโฮม\" เพื่อเปิดแบบแอปได้ทุกครั้ง",
    action: null,
  },
  "desktop-extension": {
    title: "ติดตั้งส่วนขยาย Kunjae",
    body: "เติมรหัสผ่านและรหัส 2FA ในหน้าเว็บได้โดยไม่ต้องคัดลอก",
    action: "ไปที่ Chrome Web Store",
  },
};

export const InstallPrompt = () => {
  const [kind, setKind] = useState<Kind | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = (): void => {
      void decide().then((next) => {
        if (active) setKind(next);
      });
    };
    refresh();
    const stop = onInstallAvailabilityChange(refresh);
    return () => {
      active = false;
      stop();
    };
  }, []);

  if (kind === null) return null;

  const dismiss = (): void => {
    writeStorage(DISMISSED_KEY, String(Date.now()));
    setKind(null);
  };

  const act = async (): Promise<void> => {
    if (kind === "android-pwa") {
      const deferred = getDeferredInstall();
      if (deferred !== null) {
        await deferred.prompt();
        await deferred.userChoice;
        clearDeferredInstall();
      }
      dismiss();
      return;
    }
    const url = kind === "android-store" ? PLAY_STORE_URL : CHROME_WEB_STORE_URL;
    if (url !== null) window.open(url, "_blank", "noopener,noreferrer");
    dismiss();
  };

  const copy = COPY[kind];

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="install-title" className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/50 p-4 sm:items-center">
      <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 text-center shadow-xl">
        <div className="flex justify-center">
          <KunjaeMark size={64} />
        </div>
        <h2 id="install-title" className="text-lg font-semibold text-stone-900">
          {copy.title}
        </h2>
        <p className="text-sm text-stone-600">{copy.body}</p>
        {copy.action !== null && (
          <button
            type="button"
            onClick={() => {
              void act();
            }}
            className="w-full rounded-full bg-brand-400 px-5 py-3 text-sm font-medium text-brand-950 hover:bg-brand-300"
          >
            {copy.action}
          </button>
        )}
        <button type="button" onClick={dismiss} className="text-sm text-stone-500 underline">
          {copy.action === null ? "เข้าใจแล้ว" : "ใช้ต่อในเบราว์เซอร์"}
        </button>
      </div>
    </div>
  );
};
