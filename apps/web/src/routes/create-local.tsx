import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import { createLocalVault, errorMessage } from "@kunjae/client-core";
import { Button, Callout, Card, Field } from "../ui/primitives.tsx";
import { useLang, useT } from "../i18n/index.ts";
import { refreshLocalPresence, useLocalPresence } from "../session/local-presence.ts";

export const CreateLocalPage = () => {
  const navigate = useNavigate();
  const lang = useLang();
  const t = useT();
  const presence = useLocalPresence();
  const [masterPassword, setMasterPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (presence === "present" && !busy) void navigate({ to: "/" });
  }, [presence, busy, navigate]);

  const submit = async (): Promise<void> => {
    if (masterPassword !== confirm) {
      setError(t.local.mismatch);
      return;
    }

    setBusy(true);
    setError(null);

    const result = await createLocalVault({ masterPassword, lang, nowMs: Date.now() });

    if (!result.ok) {
      setError(errorMessage(result.error, lang));
      setBusy(false);
      return;
    }

    setMasterPassword("");
    setConfirm("");

    await navigate({ to: "/vault" });
    await refreshLocalPresence();
  };

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <p className="text-sm">
        <Link to="/" className="font-medium text-brand-700 hover:underline">
          {t.local.back}
        </Link>
      </p>

      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold text-brand-900">{t.local.createTitle}</h1>
        <p className="text-sm text-stone-600">{t.local.createSubtitle}</p>
      </header>

      <Callout tone="warning">
        <strong>{t.local.warnTitle}</strong>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{t.local.warnForgot}</li>
          <li>{t.local.warnClear}</li>
          <li>{t.local.warnExport}</li>
        </ul>
      </Callout>

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
            hint={t.local.passwordHint}
            sensitive
            autoFocus
          />

          <Field
            label={t.local.confirmLabel}
            type="password"
            value={confirm}
            onChange={setConfirm}
            sensitive
          />

          <label className="flex items-start gap-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => { setAcknowledged(event.target.checked); }}
              className="mt-1"
            />
            <span>{t.local.acknowledge}</span>
          </label>

          {error !== null && <Callout tone="danger">{error}</Callout>}

          <Button type="submit" disabled={busy || !acknowledged}>
            {busy ? t.local.createBusy : t.local.createSubmit}
          </Button>

          {busy && <p className="text-xs text-stone-500">{t.unlock.argonNote}</p>}
        </form>
      </Card>
    </div>
  );
};
