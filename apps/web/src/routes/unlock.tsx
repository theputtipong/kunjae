import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import { unlock } from "@kunjae/client-core";
import { errorMessage } from "@kunjae/client-core";
import { clearStore, pull } from "@kunjae/client-core";
import { Button, Callout, Card, Field } from "../ui/primitives.tsx";
import { KunjaeMark } from "../ui/kunjae-mark.tsx";
import { useLang, useT } from "../i18n/index.ts";

export const UnlockPage = () => {
  const navigate = useNavigate();
  const lang = useLang();
  const t = useT();
  const [email, setEmail] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [secretKeyText, setSecretKeyText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);

    const nowMs = Date.now();
    const result = await unlock({ email, masterPassword, secretKeyText, nowMs });

    if (!result.ok) {
      setError(errorMessage(result.error, lang));
      setBusy(false);
      return;
    }

    setMasterPassword("");
    setSecretKeyText("");

    clearStore();
    await pull(nowMs);

    await navigate({ to: "/vault" });
  };

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <p className="text-sm">
        <Link to="/" className="font-medium text-brand-700 hover:underline">
          {t.local.back}
        </Link>
      </p>

      <header className="space-y-3 text-center">
        <div className="flex justify-center">
          <KunjaeMark size={80} label={t.unlock.markLabel} />
        </div>
        <h1 className="text-2xl font-semibold text-stone-900">{t.unlock.title}</h1>
        <p className="text-sm text-stone-600">{t.unlock.subtitle}</p>
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
            label={t.common.email}
            type="email"
            value={email}
            onChange={setEmail}
            hint={t.unlock.emailHint}
            autoFocus
          />

          <fieldset className="space-y-4 rounded-2xl bg-stone-100 p-4">
            <legend className="float-left mb-1 flex w-full items-center gap-2 text-sm font-semibold text-stone-900">
              <KunjaeMark size={18} tile={false} /> {t.unlock.twoKeys}
            </legend>

            <Field
              label="Master Password"
              type="password"
              value={masterPassword}
              onChange={setMasterPassword}
              hint={t.unlock.masterPasswordHint}
              sensitive
            />

            <Field
              label="Secret Key"
              value={secretKeyText}
              onChange={setSecretKeyText}
              placeholder="K1-UUUUUU-UUUUU-UUUUU-UUUUU-UUUUU"
              hint={t.unlock.secretKeyHint}
              sensitive
            />
          </fieldset>

          {error !== null && <Callout tone="danger">{error}</Callout>}

          <div className="grid">
            <Button type="submit" disabled={busy}>
              {busy ? t.unlock.busy : t.unlock.submit}
            </Button>
          </div>

          {busy && (
            <p className="text-xs text-stone-500">
              {t.unlock.argonNote}
            </p>
          )}
        </form>
      </Card>

      <details className="rounded-2xl border border-stone-200 bg-surface px-4 py-3 text-sm text-stone-700">
        <summary className="cursor-pointer font-medium text-brand-700">{t.unlock.whatIsSecretKey}</summary>
        <div className="mt-2 space-y-2">
          <p>{t.unlock.secretKeyAbout1}</p>
          <p>{t.unlock.secretKeyAbout2}</p>
          <p className="font-medium text-red-800">{t.unlock.secretKeyAbout3}</p>
        </div>
      </details>

      <p className="text-center text-sm text-stone-600">
        {t.unlock.noAccount}{" "}
        <Link to="/sign-up" className="font-medium text-brand-700 hover:underline">
          {t.unlock.signUp}
        </Link>
      </p>
    </div>
  );
};
