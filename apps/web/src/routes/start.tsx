import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import { errorMessage, unlockLocal } from "@kunjae/client-core";
import { Button, Callout, Card, Field } from "../ui/primitives.tsx";
import { KunjaeMark } from "../ui/kunjae-mark.tsx";
import { DeleteLocalVaultForm } from "../ui/local-vault.tsx";
import { useLang, useT } from "../i18n/index.ts";
import { useLocalPresence } from "../session/local-presence.ts";

const WelcomeScreen = () => {
  const t = useT();

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <header className="space-y-3 pt-6 text-center">
        <div className="flex justify-center">
          <KunjaeMark size={80} label={t.unlock.markLabel} />
        </div>
        <h1 className="text-2xl font-semibold text-stone-900">{t.local.welcomeTitle}</h1>
        <p className="text-sm text-stone-600">{t.local.welcomeSubtitle}</p>
      </header>

      <Card>
        <div className="space-y-3 text-center">
          <Link
            to="/start-local"
            className="block rounded-full bg-brand-400 px-5 py-3 text-sm font-semibold text-brand-950 hover:bg-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {t.local.start}
          </Link>
          <p className="text-sm text-stone-600">{t.local.startSub}</p>
        </div>
      </Card>

      <div className="space-y-2 text-center text-sm text-stone-600">
        <p>{t.local.haveAccount}</p>
        <div className="flex justify-center gap-2">
          <Link
            to="/sign-in"
            className="rounded-full border border-stone-300 bg-surface px-5 py-2 font-medium text-stone-700 hover:bg-stone-50"
          >
            {t.local.signIn}
          </Link>
          <Link
            to="/sign-up"
            className="rounded-full border border-stone-300 bg-surface px-5 py-2 font-medium text-stone-700 hover:bg-stone-50"
          >
            {t.local.createAccount}
          </Link>
        </div>
      </div>

      <p className="text-center text-sm">
        <Link to="/welcome" className="font-medium text-brand-700 hover:underline">
          {t.onboarding.open}
        </Link>
      </p>
    </div>
  );
};

const LocalUnlockScreen = () => {
  const navigate = useNavigate();
  const lang = useLang();
  const t = useT();
  const [masterPassword, setMasterPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);

    const result = await unlockLocal({ masterPassword, nowMs: Date.now() });

    setMasterPassword("");

    if (!result.ok) {
      setError(errorMessage(result.error, lang));
      setBusy(false);
      return;
    }

    await navigate({ to: "/vault" });
  };

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <header className="space-y-3 pt-6 text-center">
        <div className="flex justify-center">
          <KunjaeMark size={80} label={t.unlock.markLabel} />
        </div>
        <h1 className="text-2xl font-semibold text-stone-900">{t.local.unlockTitle}</h1>
        <p className="text-sm text-stone-600">{t.local.unlockSubtitle}</p>
      </header>

      <Card>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Field
            label={t.local.passwordLabel}
            type="password"
            value={masterPassword}
            onChange={setMasterPassword}
            sensitive
            autoFocus
          />

          {error !== null && <Callout tone="danger">{error}</Callout>}

          <div className="grid">
            <Button type="submit" disabled={busy || masterPassword === ""}>
              {busy ? t.local.unlockBusy : t.local.unlockSubmit}
            </Button>
          </div>

          {busy && <p className="text-xs text-stone-500">{t.unlock.argonNote}</p>}
        </form>
      </Card>

      <p className="text-center text-sm">
        <Link to="/sign-in" className="font-medium text-brand-700 hover:underline">
          {t.local.useAccount}
        </Link>
      </p>

      <p className="text-center text-sm">
        <Link to="/welcome" className="font-medium text-brand-700 hover:underline">
          {t.onboarding.open}
        </Link>
      </p>

      <details className="rounded-2xl border border-stone-200 bg-surface px-4 py-3 text-sm text-stone-700">
        <summary className="cursor-pointer font-medium text-brand-700">{t.local.forgotTitle}</summary>
        <div className="mt-3 space-y-3">
          <Callout tone="danger">{t.local.forgotBody}</Callout>
          <DeleteLocalVaultForm />
        </div>
      </details>
    </div>
  );
};

export const StartPage = () => {
  const presence = useLocalPresence();

  if (presence === "unknown") return null;

  return presence === "present" ? <LocalUnlockScreen /> : <WelcomeScreen />;
};
