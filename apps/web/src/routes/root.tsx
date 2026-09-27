import { useEffect, useRef } from "react";
import { Link, Outlet } from "@tanstack/react-router";

import { startAutoLock } from "@kunjae/client-core";
import { lockSession } from "@kunjae/client-core";
import { useSession } from "../session/use-session.ts";
import { KunjaeMark } from "../ui/kunjae-mark.tsx";
import { InstallPrompt } from "../ui/install-prompt.tsx";
import { clearStore } from "@kunjae/client-core";
import { useT } from "../i18n/index.ts";
import { LanguageToggle, SupportLink, ThemeToggle } from "../ui/preferences.tsx";
import { LegalLinks } from "./legal.tsx";
import { SiteMenu } from "../ui/site-menu.tsx";

export const RootLayout = () => {
  const session = useSession();
  const t = useT();
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
      <header className="border-b border-stone-200 bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Link to="/vault" className="flex items-center gap-2 text-base font-semibold text-stone-900">
              <KunjaeMark size={32} unlocked={session.status === "unlocked"} />
              Kunjae
              <span className="sr-only">{session.status === "unlocked" ? t.header.unlockedSr : t.header.lockedSr}</span>
            </Link>

            {session.mode === "local" && (
              <span
                title={t.local.badgeTitle}
                className="rounded-full border border-stone-300 bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700"
              >
                {t.local.badge}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {session.status === "unlocked" && (
              <nav className="flex items-center gap-3 text-sm">
                <Link to="/vault" className="text-stone-600 hover:text-stone-900">
                  {t.header.items}
                </Link>
                <Link to="/settings" className="text-stone-600 hover:text-stone-900">
                  {t.header.settings}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    lockSession();
                    clearStore();
                  }}
                  className="rounded-full bg-brand-400 px-4 py-1.5 font-medium text-brand-950 hover:bg-brand-300"
                >
                  {t.common.lock}
                </button>
              </nav>
            )}
            <div className="flex items-center gap-1.5">
              <LanguageToggle />
              <ThemeToggle />
              <SiteMenu />
            </div>
          </div>
        </div>
      </header>

      <Outlet />

      <InstallPrompt />

      <footer className="mx-auto max-w-5xl space-y-2 px-6 py-8 text-center text-xs text-stone-500">
        <p>{t.footer.encrypted}</p>
        <p>
          <SupportLink />
        </p>
        <p>
          <LegalLinks />
        </p>
      </footer>
    </div>
  );
};
