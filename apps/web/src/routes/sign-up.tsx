import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import { clearStore, pull, signUp } from "@kunjae/client-core";
import { holdEmergencyKit } from "@kunjae/client-core";
import { errorMessage } from "@kunjae/client-core";
import { Button, Callout, Card, Field } from "../ui/primitives.tsx";
import { useLang, useT } from "../i18n/index.ts";

export const SignUpPage = () => {
  const navigate = useNavigate();
  const lang = useLang();
  const t = useT();
  const [email, setEmail] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (masterPassword !== confirm) {
      setError(t.signUp.mismatch);
      return;
    }

    setBusy(true);
    setError(null);

    const result = await signUp({ email, masterPassword, nowMs: Date.now(), lang });

    if (!result.ok) {
      setError(errorMessage(result.error, lang));
      setBusy(false);
      return;
    }

    setMasterPassword("");
    setConfirm("");

    clearStore();
    await pull(Date.now());

    holdEmergencyKit(result.value);
    await navigate({ to: "/emergency-kit" });
  };

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <p className="text-sm">
        <Link to="/" className="font-medium text-brand-700 hover:underline">
          {t.local.back}
        </Link>
      </p>

      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold text-brand-900">{t.signUp.title}</h1>
      </header>

      <Callout tone="warning">
        <strong>{t.signUp.readFirst}</strong> {t.signUp.warning}
      </Callout>

      <Card>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Field label={t.common.email} type="email" value={email} onChange={setEmail} autoFocus />

          <Field
            label="Master Password"
            type="password"
            value={masterPassword}
            onChange={setMasterPassword}
            hint={t.signUp.masterPasswordHint}
            sensitive
          />

          <Field
            label={t.signUp.confirmLabel}
            type="password"
            value={confirm}
            onChange={setConfirm}
            sensitive
          />

          {error !== null && <Callout tone="danger">{error}</Callout>}

          <Button type="submit" disabled={busy}>
            {busy ? t.signUp.busy : t.signUp.submit}
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-stone-600">
        {t.signUp.haveAccount}{" "}
        <Link to="/sign-in" className="font-medium text-brand-700 hover:underline">
          {t.local.signIn}
        </Link>
      </p>
    </div>
  );
};
