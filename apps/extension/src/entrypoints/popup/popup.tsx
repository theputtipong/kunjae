import { useCallback, useEffect, useState } from "react";
import { browser } from "#imports";

import type { ItemBrief, LocalBrief } from "../../messaging.ts";
import { send } from "../../send.ts";
import { KunjaeMark } from "../../kunjae-mark.tsx";
import { describeError, dictionary } from "../../i18n.ts";

const t = dictionary();

const SUPPORT_URL = "https://buymeacoffee.com/theputtipong";

const NO_LOCAL: LocalBrief = { exists: false, itemCount: null, offerMigration: false };

const MIN_DEVICE_PASSWORD_LENGTH = 12;

const openPage = (path: `/signup.html${string}`): void => {
  void browser.tabs.create({ url: browser.runtime.getURL(path) });
};

const inputClass = "w-full rounded border border-stone-300 px-2 py-1";
const primaryClass =
  "w-full rounded-full bg-brand-400 px-3 py-1.5 font-medium text-brand-950 hover:bg-brand-300 disabled:bg-stone-200 disabled:text-stone-500";
const secondaryClass = "w-full rounded border border-stone-300 px-3 py-1.5 text-xs";
const linkClass = "text-xs text-stone-600 underline underline-offset-2 hover:text-stone-900";

const SupportLink = () => (
  <p className="pt-1 text-center text-[11px]">
    <a
      href={SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="text-stone-500 underline-offset-2 hover:text-stone-700 hover:underline"
    >
      {t.support}
    </a>
  </p>
);

export const Popup = () => {
  const [loaded, setLoaded] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [mode, setMode] = useState<"account" | "local" | null>(null);
  const [local, setLocal] = useState<LocalBrief>(NO_LOCAL);
  const [accountView, setAccountView] = useState(false);
  const [devicePassword, setDevicePassword] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [migrateMessage, setMigrateMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [secretKeyText, setSecretKeyText] = useState("");
  const [items, setItems] = useState<readonly ItemBrief[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [draft, setDraft] = useState<{
    readonly itemId: string | null;
    readonly title: string;
    readonly username: string;
    readonly password: string;
    readonly url: string;
    readonly totpSecret: string;
  } | null>(null);

  const [reloadToken, setReloadToken] = useState(0);
  const refresh = useCallback(() => { setReloadToken((value) => value + 1); }, []);

  useEffect(() => {
    const controller = new AbortController();

    const aborted = (): boolean => controller.signal.aborted;

    const load = async (): Promise<void> => {
      const theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      const status = await send({ kind: "status", theme });
      if (aborted() || !status.ok || status.kind !== "status") return;

      setLoaded(true);
      setUnlocked(status.unlocked);
      setMode(status.mode);
      setLocal(status.local);
      if (status.email !== null) setEmail(status.email);
      if (!status.unlocked) return;

      const list = await send({ kind: "list" });
      if (aborted() || !list.ok || list.kind !== "list") return;

      setItems(list.items);
    };

    void load();

    return () => {
      controller.abort();
    };
  }, [reloadToken]);

  const doUnlock = async (): Promise<void> => {
    setBusy(true);
    setMessage(null);

    const result = await send({ kind: "unlock", email, masterPassword, secretKeyText });

    setMasterPassword("");
    setSecretKeyText("");

    if (!result.ok) setMessage(describeError(t, result));
    else {
      setAccountView(false);
      refresh();
    }

    setBusy(false);
  };

  const doLocalUnlock = async (): Promise<void> => {
    setBusy(true);
    setMessage(null);

    const result = await send({ kind: "local-unlock", masterPassword: devicePassword });

    setDevicePassword("");
    setBusy(false);

    if (!result.ok) setMessage(describeError(t, result));
    else refresh();
  };

  const doLocalDelete = async (): Promise<void> => {
    setBusy(true);
    setMessage(null);

    const result = await send({ kind: "local-delete", confirm: true });

    setDeletePhrase("");
    setBusy(false);

    if (!result.ok) {
      setMessage(describeError(t, result));
      return;
    }

    setForgotOpen(false);
    setMessage(t.local.deleted);
    refresh();
  };

  const doMigrate = async (): Promise<void> => {
    setBusy(true);
    setMigrateMessage(null);

    const result = await send({ kind: "local-migrate", devicePassword });

    setDevicePassword("");
    setBusy(false);

    if (!result.ok || result.kind !== "migrated") {
      setMigrateMessage(result.ok ? t.errors["bad-response"] : describeError(t, result));
      return;
    }

    setMigrateMessage(
      result.failed > 0
        ? t.local.migratedPartial(result.moved, result.failed)
        : result.cleared
          ? t.local.migrated(result.moved)
          : t.local.migratedNotCleared(result.moved),
    );
    refresh();
  };

  const dismissMigration = (): void => {
    setDevicePassword("");
    void send({ kind: "local-dismiss-migration" }).then(refresh, refresh);
  };

  const copyPassword = async (itemId: string): Promise<void> => {
    const result = await send({ kind: "reveal", itemId });
    if (!result.ok || result.kind !== "reveal") {
      setMessage(result.ok ? t.passwordMissing : describeError(t, result));
      return;
    }

    await navigator.clipboard.writeText(result.password);
    setMessage(t.copied);
  };

  const copyTotp = async (itemId: string): Promise<void> => {
    const result = await send({ kind: "totp", itemId });
    if (!result.ok || result.kind !== "totp") {
      setMessage(result.ok ? t.codeFailed : describeError(t, result));
      return;
    }

    await navigator.clipboard.writeText(result.code);
    setMessage(t.totpCopied(result.secondsRemaining));
  };

  const openEditor = async (itemId: string | null): Promise<void> => {
    if (itemId === null) {
      setDraft({ itemId: null, title: "", username: "", password: "", url: "", totpSecret: "" });
      return;
    }

    const result = await send({ kind: "load-for-edit", itemId });
    if (!result.ok || result.kind !== "editable") {
      setMessage(result.ok ? t.loadFailed : describeError(t, result));
      return;
    }

    setDraft({
      itemId,
      title: result.title,
      username: result.username,
      password: result.password,
      url: result.url,
      totpSecret: result.totpSecret,
    });
  };

  const closeEditor = (): void => {
    setDraft(null);
  };

  const saveDraft = async (): Promise<void> => {
    if (draft === null) return;

    setBusy(true);
    const result = await send({ kind: "save", ...draft });
    setBusy(false);

    if (!result.ok) {
      setMessage(describeError(t, result));
      return;
    }

    closeEditor();
    setMessage(t.saved);
    refresh();
  };

  const fillTotp = async (itemId: string): Promise<void> => {
    const result = await send({ kind: "fill-totp", itemId });
    setMessage(result.ok ? t.totpFilled : describeError(t, result));
  };

  const fill = async (itemId: string): Promise<void> => {
    const result = await send({ kind: "fill", itemId });
    setMessage(result.ok ? t.filled : describeError(t, result));
  };

  const header = (
    <h1 className="flex items-center gap-2 text-base font-semibold text-stone-900">
      <KunjaeMark size={28} unlocked={unlocked} />
      Kunjae
      {unlocked && mode === "local" && (
        <span
          title={t.local.badgeTitle}
          className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700"
        >
          {t.local.badge}
        </span>
      )}
    </h1>
  );

  if (!loaded) return <div className="p-4 text-sm">{header}</div>;

  const showAccountForm = accountView;

  if (!unlocked && !showAccountForm && local.exists) {
    return (
      <div className="space-y-3 p-4 text-sm">
        {header}

        <div>
          <p className="font-medium text-stone-900">{t.local.unlockTitle}</p>
          <p className="text-xs text-stone-600">{t.local.unlockSubtitle}</p>
        </div>

        {!forgotOpen ? (
          <>
            <input
              className={inputClass}
              placeholder={t.local.passwordLabel}
              aria-label={t.local.passwordLabel}
              type="password"
              autoComplete="one-time-code"
              spellCheck={false}
              translate="no"
              value={devicePassword}
              onChange={(event) => { setDevicePassword(event.target.value); }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && devicePassword.length >= MIN_DEVICE_PASSWORD_LENGTH && !busy) {
                  void doLocalUnlock();
                }
              }}
            />

            <button
              type="button"
              disabled={busy || devicePassword.length < MIN_DEVICE_PASSWORD_LENGTH}
              onClick={() => { void doLocalUnlock(); }}
              className={primaryClass}
            >
              {busy ? t.local.unlockBusy : t.unlock}
            </button>

            {message !== null && <p className="text-xs text-red-700">{message}</p>}

            <div className="flex flex-wrap justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setMessage(null);
                  setDevicePassword("");
                  setAccountView(true);
                }}
                className={linkClass}
              >
                {t.local.useAccount}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMessage(null);
                  setDevicePassword("");
                  setForgotOpen(true);
                }}
                className={linkClass}
              >
                {t.local.forgotLink}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-2 rounded border border-red-300 bg-red-50 p-2">
            <p className="text-xs text-red-800">{t.local.forgotBody}</p>
            <input
              className={inputClass}
              placeholder={t.local.typeToConfirm(t.local.deleteConfirmPhrase)}
              aria-label={t.local.typeToConfirm(t.local.deleteConfirmPhrase)}
              autoComplete="off"
              spellCheck={false}
              value={deletePhrase}
              onChange={(event) => { setDeletePhrase(event.target.value); }}
            />
            {message !== null && <p className="text-xs text-red-700">{message}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || deletePhrase.trim() !== t.local.deleteConfirmPhrase}
                onClick={() => { void doLocalDelete(); }}
                className="rounded bg-red-700 px-2 py-1 text-xs font-medium text-white disabled:bg-stone-200 disabled:text-stone-500"
              >
                {busy ? t.local.deleting : t.local.deleteSubmit}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForgotOpen(false);
                  setDeletePhrase("");
                  setMessage(null);
                }}
                className="rounded border border-stone-300 px-2 py-1 text-xs"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        <SupportLink />
      </div>
    );
  }

  if (!unlocked && !showAccountForm) {
    return (
      <div className="space-y-3 p-4 text-sm">
        {header}

        <div>
          <p className="font-medium text-stone-900">{t.local.welcomeTitle}</p>
          <p className="text-xs text-stone-600">{t.local.welcomeSubtitle}</p>
        </div>

        {message !== null && <p className="text-xs text-stone-700">{message}</p>}

        <button type="button" onClick={() => { openPage("/signup.html?mode=local"); }} className={primaryClass}>
          {t.local.start}
        </button>
        <p className="text-[11px] text-stone-500">{t.local.startSub}</p>

        <p className="pt-1 text-xs text-stone-600">{t.local.haveAccount}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setAccountView(true);
            }}
            className={secondaryClass}
          >
            {t.local.signIn}
          </button>
          <button type="button" onClick={() => { openPage("/signup.html"); }} className={secondaryClass}>
            {t.local.createAccount}
          </button>
        </div>

        <p className="text-center">
          <button type="button" onClick={() => { openPage("/signup.html?mode=welcome"); }} className={linkClass}>
            {t.onboarding.open}
          </button>
        </p>

        <SupportLink />
      </div>
    );
  }

  if (showAccountForm) {
    return (
      <div className="space-y-3 p-4 text-sm">
        {header}

        {unlocked && mode === "local" && (
          <p className="text-[11px] leading-snug text-stone-600">{t.local.signInNote}</p>
        )}

        <input
          className="w-full rounded border border-stone-300 px-2 py-1"
          placeholder={t.email}
          type="email"
          value={email}
          onChange={(event) => { setEmail(event.target.value); }}
        />

        <input
          className="w-full rounded border border-stone-300 px-2 py-1"
          placeholder={t.masterPassword}
          type="password"
          autoComplete="one-time-code"
          spellCheck={false}
          translate="no"
          value={masterPassword}
          onChange={(event) => { setMasterPassword(event.target.value); }}
        />

        <input
          className="w-full rounded border border-stone-300 px-2 py-1"
          placeholder={t.secretKey}
          autoComplete="off"
          spellCheck={false}
          translate="no"
          autoCapitalize="off"
          autoCorrect="off"
          value={secretKeyText}
          onChange={(event) => { setSecretKeyText(event.target.value); }}
        />

        <button
          type="button"
          disabled={busy}
          onClick={() => { void doUnlock(); }}
          className="w-full rounded-full bg-brand-400 px-3 py-1.5 font-medium text-brand-950 hover:bg-brand-300 disabled:bg-stone-200 disabled:text-stone-500"
        >
          {busy ? t.deriving : t.unlock}
        </button>

        {message !== null && <p className="text-xs text-red-700">{message}</p>}

        <button type="button" onClick={() => { openPage("/signup.html"); }} className={secondaryClass}>
          {t.noAccount}
        </button>

        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setMasterPassword("");
            setSecretKeyText("");
            setAccountView(false);
          }}
          className={linkClass}
        >
          {t.local.back}
        </button>

        <p className="text-[11px] leading-snug text-stone-500">
          {t.memoryNote}
        </p>

        <SupportLink />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 text-sm">
      <div className="flex items-center justify-between">
        {header}
        <button
          type="button"
          onClick={() => {
            setMigrateMessage(null);
            setDevicePassword("");
            setAccountView(false);
            void send({ kind: "lock" }).then(refresh, refresh);
          }}
          className="rounded border border-stone-300 px-2 py-1 text-xs"
        >
          {t.lock}
        </button>
      </div>

      {mode === "local" && draft === null && (
        <div className="space-y-1 rounded border border-stone-200 bg-stone-50 p-2 text-[11px] leading-snug text-stone-600">
          <p>{t.local.banner}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setAccountView(true);
              }}
              className="font-medium text-stone-900 underline underline-offset-2"
            >
              {t.local.bannerLink}
            </button>
            <button type="button" onClick={() => { openPage("/signup.html"); }} className="underline underline-offset-2">
              {t.local.createAccount}
            </button>
            <button
              type="button"
              onClick={() => { openPage("/signup.html?mode=local-password"); }}
              className="underline underline-offset-2"
            >
              {t.local.changeLink}
            </button>
          </div>
        </div>
      )}

      {mode === "account" && draft === null && migrateMessage !== null && (
        <p className="rounded border border-stone-200 bg-stone-50 p-2 text-xs text-stone-700">{migrateMessage}</p>
      )}

      {mode === "account" && draft === null && local.offerMigration && local.itemCount !== null && (
        <div className="space-y-2 rounded border border-brand-400 bg-brand-100 p-2 text-xs">
          <p className="font-medium text-stone-900">{t.local.migrateTitle(local.itemCount)}</p>
          <p className="text-stone-700">{t.local.migrateBody}</p>
          <input
            className={inputClass}
            placeholder={t.local.passwordLabel}
            aria-label={t.local.passwordLabel}
            type="password"
            autoComplete="one-time-code"
            spellCheck={false}
            translate="no"
            value={devicePassword}
            onChange={(event) => { setDevicePassword(event.target.value); }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || devicePassword.length < MIN_DEVICE_PASSWORD_LENGTH}
              onClick={() => { void doMigrate(); }}
              className="rounded-full bg-brand-400 px-2 py-1 font-medium text-brand-950 hover:bg-brand-300 disabled:bg-stone-200 disabled:text-stone-500"
            >
              {busy ? t.local.migrateBusy : t.local.migrateSubmit}
            </button>
            <button type="button" onClick={dismissMigration} className="rounded border border-stone-300 px-2 py-1">
              {t.local.notNow}
            </button>
          </div>
        </div>
      )}

      {draft !== null ? (
        <div className="space-y-2">
          <p className="font-medium text-stone-900">
            {draft.itemId === null ? t.newItem : t.editItem}
          </p>

          {(
            [
              [t.fieldTitle, "title", "text"],
              [t.fieldUsername, "username", "text"],
              [t.fieldPassword, "password", "password"],
              [t.fieldUrl, "url", "text"],
              [t.fieldTotp, "totpSecret", "password"],
            ] as const
          ).map(([label, field, type]) => (
            <input
              key={field}
              className="w-full rounded border border-stone-300 px-2 py-1"
              placeholder={label}
              type={type}
              autoComplete={type === "password" ? "one-time-code" : "off"}
              spellCheck={false}
              translate="no"
              value={draft[field]}
              onChange={(event) => {
                setDraft((current) =>
                  current === null ? current : { ...current, [field]: event.target.value },
                );
              }}
            />
          ))}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || draft.title.trim() === ""}
              onClick={() => { void saveDraft(); }}
              className="rounded-full bg-brand-400 px-2 py-1 text-xs font-medium text-brand-950 hover:bg-brand-300 disabled:bg-stone-200 disabled:text-stone-500"
            >
              {busy ? t.saving : t.save}
            </button>
            <button
              type="button"
              onClick={closeEditor}
              className="rounded border border-stone-300 px-2 py-1 text-xs"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { void openEditor(null); }}
          className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
        >
          {t.addItem}
        </button>
      )}

      {items.length === 0 && draft === null && <p className="text-stone-600">{t.noItems}</p>}

      <ul className={`max-h-80 space-y-2 overflow-y-auto ${draft === null ? "" : "hidden"}`}>
        {items.map((item) => (
          <li key={item.itemId} className="rounded border border-stone-200 p-2">
            <p className="font-medium text-stone-900">{item.title || t.untitled}</p>
            <p className="text-xs text-stone-500">
              {item.username}
              {item.host !== "" && ` · ${item.host}`}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => { void fill(item.itemId); }}
                className="rounded-full bg-brand-400 px-2 py-1 text-xs font-medium text-brand-950 hover:bg-brand-300"
              >
                {t.fillHere}
              </button>
              <button
                type="button"
                onClick={() => { void copyPassword(item.itemId); }}
                className="rounded border border-stone-300 px-2 py-1 text-xs"
              >
                {t.copyPassword}
              </button>
              <button
                type="button"
                onClick={() => { void openEditor(item.itemId); }}
                className="rounded border border-stone-300 px-2 py-1 text-xs"
              >
                {t.edit}
              </button>
              {item.hasTotp && (
                <>
                  <button
                    type="button"
                    onClick={() => { void fillTotp(item.itemId); }}
                    className="rounded border border-stone-300 px-2 py-1 text-xs"
                  >
                    {t.fillTotp}
                  </button>
                  <button
                    type="button"
                    onClick={() => { void copyTotp(item.itemId); }}
                    className="rounded border border-stone-300 px-2 py-1 text-xs"
                  >
                    {t.copyTotp}
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {message !== null && <p className="text-xs text-stone-700">{message}</p>}

      <SupportLink />
    </div>
  );
};
