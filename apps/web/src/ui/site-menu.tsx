import { useRef } from "react";
import { Link } from "@tanstack/react-router";

import { useT } from "../i18n/index.ts";

const ITEM_CLASS = "block rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-100 hover:text-stone-900";

export const SiteMenu = () => {
  const t = useT();
  const menu = useRef<HTMLDetailsElement>(null);
  const close = (): void => {
    if (menu.current !== null) menu.current.open = false;
  };

  return (
    <details ref={menu} className="relative">
      <summary
        aria-label={t.nav.menu}
        title={t.nav.menu}
        className="inline-flex h-8 min-w-8 cursor-pointer list-none items-center justify-center rounded-full border border-stone-300 px-2 text-stone-600 hover:bg-stone-50 hover:text-stone-900 [&::-webkit-details-marker]:hidden"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </summary>
      <nav className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-stone-200 bg-surface p-1.5 shadow-lg">
        <Link to="/contact" onClick={close} className={ITEM_CLASS}>
          {t.nav.contact}
        </Link>
        <Link to="/delete-account" onClick={close} className={ITEM_CLASS}>
          {t.nav.deleteAccount}
        </Link>
        <Link to="/privacy" onClick={close} className={ITEM_CLASS}>
          {t.legal.privacy}
        </Link>
        <Link to="/terms" onClick={close} className={ITEM_CLASS}>
          {t.legal.terms}
        </Link>
      </nav>
    </details>
  );
};
