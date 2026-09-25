import { useEffect, useRef } from "react";
import { Link, Outlet } from "@tanstack/react-router";

import { startAutoLock } from "@kunjae/client-core";
import { lockSession } from "@kunjae/client-core";
import { useSession } from "../session/use-session.ts";
import { KunjaeMark } from "../ui/kunjae-mark.tsx";
import { clearStore } from "@kunjae/client-core";

export const RootLayout = () => {
  const session = useSession();
  const previousStatus = useRef(session.status);

  useEffect(() => {
    return startAutoLock({ now: () => Date.now(), target: window });
  }, []);

  useEffect(() => {
    if (previousStatus.current === "unlocked" && session.status === "locked") {
      clearStore();
    }
    previousStatus.current = session.status;
  }, [session.status]);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <Link to="/vault" className="flex items-center gap-2 text-base font-semibold text-stone-900">
            <KunjaeMark size={32} unlocked={session.status === "unlocked"} />
            Kunjae
            <span className="sr-only">{session.status === "unlocked" ? " (ปลดล็อกอยู่)" : " (ล็อกอยู่)"}</span>
          </Link>

          {session.status === "unlocked" && (
            <nav className="flex items-center gap-3 text-sm">
              <Link to="/vault" className="text-stone-600 hover:text-stone-900">
                รายการ
              </Link>
              <Link to="/settings" className="text-stone-600 hover:text-stone-900">
                ตั้งค่า
              </Link>
              <button
                type="button"
                onClick={() => {
                  lockSession();
                  clearStore();
                }}
                className="rounded-full bg-brand-400 px-4 py-1.5 font-medium text-brand-950 hover:bg-brand-300"
              >
                ล็อก
              </button>
            </nav>
          )}
        </div>
      </header>

      <Outlet />

      <footer className="mx-auto max-w-5xl px-6 py-8 text-center text-xs text-stone-500">
        ข้อมูลของคุณถูกเข้ารหัสในเบราว์เซอร์นี้ก่อนออกจากเครื่องเสมอ
      </footer>
    </div>
  );
};
