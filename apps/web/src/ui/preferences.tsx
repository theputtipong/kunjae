import { setLang, useLang, useT } from "../i18n/index.ts";
import { nextThemeMode, setThemeMode, useThemeMode, type ThemeMode } from "../theme.ts";

export const SUPPORT_URL = "https://buymeacoffee.com/theputtipong";

const TOGGLE_CLASS =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-stone-300 px-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

export const LanguageToggle = () => {
  const lang = useLang();
  const t = useT();
  const other = lang === "en" ? "th" : "en";

  return (
    <button
      type="button"
      onClick={() => {
        setLang(other);
      }}
      aria-label={t.lang.switchLabel}
      title={t.lang.switchLabel}
      className={TOGGLE_CLASS}
    >
      <span lang={other}>{t.lang.switchTo}</span>
    </button>
  );
};

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const MonitorIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const THEME_ICON: Readonly<Record<ThemeMode, () => React.JSX.Element>> = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
};

export const ThemeToggle = () => {
  const mode = useThemeMode();
  const t = useT();
  const next = nextThemeMode(mode);
  const label = t.theme.toggle(t.theme[mode], t.theme[next]);
  const Icon = THEME_ICON[mode];

  return (
    <button
      type="button"
      onClick={() => {
        setThemeMode(next);
      }}
      aria-label={label}
      title={label}
      className={TOGGLE_CLASS}
    >
      <Icon />
    </button>
  );
};

export const SupportLink = ({ className = "" }: { readonly className?: string }) => {
  const t = useT();

  return (
    <a
      href={SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`underline decoration-stone-300 underline-offset-2 hover:text-stone-900 hover:decoration-stone-500 ${className}`}
    >
      {t.footer.support}
    </a>
  );
};
