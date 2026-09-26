import { useEffect, useState } from "react";

import {
  deleteLocalVault,
  errorMessage,
  getLocalVaultSummary,
  migrateLocalToAccount,
} from "@kunjae/client-core";
import { useLang, useT } from "../i18n/index.ts";
import { dismissMigration, refreshLocalPresence, useLocalPresence } from "../session/local-presence.ts";
import { Button, Callout, Field } from "./primitives.tsx";

export const DeleteLocalVaultForm = ({ onDeleted }: { readonly onDeleted?: () => void }) => {
  const lang = useLang();
  const t = useT();
  const confirmPhrase = t.local.deleteConfirmPhrase;
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);

    const result = await deleteLocalVault();

    setBusy(false);
    setPhrase("");

    if (!result.ok) {
      setError(errorMessage(result.error, lang));
      return;
    }

    await refreshLocalPresence();
    onDeleted?.();
  };

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => { setOpen(true); }}>
        {t.local.deleteOpen}
      </Button>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Field label={t.settings.typeToConfirm(confirmPhrase)} value={phrase} onChange={setPhrase} />

      {error !== null && <Callout tone="danger">{error}</Callout>}

      <div className="flex gap-2">
        <Button type="submit" variant="danger" disabled={busy || phrase !== confirmPhrase}>
          {busy ? t.local.deleting : t.local.deleteSubmit}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setPhrase("");
            setError(null);
          }}
        >
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
};

export const MigrateLocalCard = ({ dismissible }: { readonly dismissible: boolean }) => {
  const lang = useLang();
  const t = useT();
  const presence = useLocalPresence();
  const [count, setCount] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ readonly tone: "success" | "warning"; readonly text: string } | null>(null);

  useEffect(() => {
    if (presence !== "present") return;

    let active = true;
    void getLocalVaultSummary().then((summary) => {
      if (active) setCount(summary.ok ? (summary.value?.itemCount ?? null) : null);
    });
    return () => {
      active = false;
    };
  }, [presence]);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);

    const result = await migrateLocalToAccount({ devicePassword: password, nowMs: Date.now() });

    setPassword("");
    setBusy(false);

    if (!result.ok) {
      setError(errorMessage(result.error, lang));
      return;
    }

    const { moved, failed, cleared } = result.value;
    if (failed > 0) {
      setMessage({ tone: "warning", text: t.local.migratedPartial(moved, failed) });
      const summary = await getLocalVaultSummary();
      setCount(summary.ok ? (summary.value?.itemCount ?? null) : null);
      return;
    }

    setMessage(
      cleared
        ? { tone: "success", text: t.local.migrated(moved) }
        : { tone: "warning", text: t.local.migratedNotCleared(moved) },
    );
    await refreshLocalPresence();
  };

  if (message !== null && (presence !== "present" || message.tone === "warning")) {
    return <Callout tone={message.tone}>{message.text}</Callout>;
  }

  if (presence !== "present" || count === null) return null;

  return (
    <div className="space-y-3 rounded-3xl border border-stone-200 bg-brand-50 p-5">
      <h2 className="text-base font-semibold text-stone-900">{t.local.migrateTitle(count)}</h2>
      <p className="text-sm text-stone-700">{t.local.migrateBody}</p>

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field
          label={t.local.migratePassword}
          type="password"
          value={password}
          onChange={setPassword}
          sensitive
        />

        {error !== null && <Callout tone="danger">{error}</Callout>}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || password === ""}>
            {busy ? t.local.migrateBusy : t.local.migrateSubmit}
          </Button>
          {dismissible && (
            <Button
              variant="ghost"
              onClick={() => {
                setPassword("");
                dismissMigration();
              }}
            >
              {t.local.notNow}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};
