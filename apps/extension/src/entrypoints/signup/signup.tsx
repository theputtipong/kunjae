import { useEffect, useState } from "react";

import { send } from "../../send.ts";
import { describeError, dictionary } from "../../i18n.ts";

const t = dictionary();

const MIN_PASSWORD_LENGTH = 12;

export const SignUpPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kit, setKit] = useState<{ readonly email: string; readonly secretKey: string } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    document.title = t.signUpTitle;
  }, []);

  const submit = async (): Promise<void> => {
    if (password !== confirm) {
      setError(t.passwordsMismatch);
      return;
    }

    setBusy(true);
    setError(null);

    const result = await send({ kind: "sign-up", email, masterPassword: password });

    setPassword("");
    setConfirm("");
    setBusy(false);

    if (!result.ok) {
      setError(describeError(t, result));
      return;
    }

    if (result.kind !== "emergency-kit") {
      setError(t.errors["bad-response"]);
      return;
    }

    setKit({ email: result.email, secretKey: result.secretKey });
  };

  if (kit !== null) {
    return (
      <div className="space-y-4 text-sm">
        <h1 className="text-xl font-semibold text-stone-900">{t.kitTitle}</h1>

        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <strong>{t.shownOnce}</strong>
          {t.saveBeforeClosing}
          <br />
          {t.kitLoss}
        </div>

        <div>
          <p className="text-xs font-medium text-stone-500">{t.email}</p>
          <p className="text-stone-900">{kit.email}</p>
        </div>

        <div>
          <p className="text-xs font-medium text-stone-500">{t.secretKey}</p>
          <p
            translate="no"
            className="mt-1 rounded-lg bg-stone-100 px-3 py-2 font-mono break-all text-stone-900"
          >
            {kit.secretKey}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            const content = [
              "Kunjae Emergency Kit",
              "",
              `${t.email}: ${kit.email}`,
              `${t.secretKey}: ${kit.secretKey}`,
              "",
              t.kitFileNote,
            ].join("\n");

            const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "kunjae-emergency-kit.txt";
            anchor.click();
            URL.revokeObjectURL(url);
          }}
          className="rounded border border-stone-300 px-3 py-1.5"
        >
          {t.downloadKit}
        </button>

        <label className="flex items-start gap-2 text-stone-700">
          <input
            type="checkbox"
            checked={saved}
            onChange={(event) => { setSaved(event.target.checked); }}
            className="mt-1"
          />
          <span>{t.confirmSaved}</span>
        </label>

        <button
          type="button"
          disabled={!saved}
          onClick={() => { window.close(); }}
          className="rounded-full bg-brand-400 px-3 py-1.5 font-medium text-brand-950 hover:bg-brand-300 disabled:bg-stone-200 disabled:text-stone-500"
        >
          {t.closePage}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <h1 className="text-xl font-semibold text-stone-900">{t.signUpTitle}</h1>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
        <strong>{t.readFirst}</strong>
        {t.readFirstBody}
      </div>

      <input
        className="w-full rounded border border-stone-300 px-2 py-1.5"
        placeholder={t.email}
        type="email"
        value={email}
        onChange={(event) => { setEmail(event.target.value); }}
      />

      <input
        className="w-full rounded border border-stone-300 px-2 py-1.5"
        placeholder={t.passwordHint(MIN_PASSWORD_LENGTH)}
        type="password"
        autoComplete="one-time-code"
        spellCheck={false}
        translate="no"
        value={password}
        onChange={(event) => { setPassword(event.target.value); }}
      />

      <input
        className="w-full rounded border border-stone-300 px-2 py-1.5"
        placeholder={t.confirmPassword}
        type="password"
        autoComplete="one-time-code"
        spellCheck={false}
        translate="no"
        value={confirm}
        onChange={(event) => { setConfirm(event.target.value); }}
      />

      {error !== null && (
        <p className="rounded border border-red-300 bg-red-50 p-2 text-red-800">{error}</p>
      )}

      <button
        type="button"
        disabled={busy || password.length < MIN_PASSWORD_LENGTH}
        onClick={() => { void submit(); }}
        className="w-full rounded-full bg-brand-400 px-3 py-2 font-medium text-brand-950 hover:bg-brand-300 disabled:bg-stone-200 disabled:text-stone-500"
      >
        {busy ? t.creatingKey : t.signUp}
      </button>
    </div>
  );
};
