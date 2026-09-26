import { useEffect, useState } from "react";

import { send } from "../../send.ts";
import { describeError, dictionary } from "../../i18n.ts";

const t = dictionary();

const MIN_PASSWORD_LENGTH = 12;

const inputClass = "w-full rounded border border-stone-300 px-2 py-1.5";
const primaryClass =
  "w-full rounded-full bg-brand-400 px-3 py-2 font-medium text-brand-950 hover:bg-brand-300 disabled:bg-stone-200 disabled:text-stone-500";

const PasswordInput = ({
  placeholder,
  value,
  onChange,
}: {
  readonly placeholder: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) => (
  <input
    className={inputClass}
    placeholder={placeholder}
    aria-label={placeholder}
    type="password"
    autoComplete="one-time-code"
    spellCheck={false}
    translate="no"
    value={value}
    onChange={(event) => { onChange(event.target.value); }}
  />
);

const ErrorBox = ({ text }: { readonly text: string }) => (
  <p className="rounded border border-red-300 bg-red-50 p-2 text-red-800">{text}</p>
);

export const CreateLocalPage = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"checking" | "form" | "exists" | "created">("checking");

  useEffect(() => {
    document.title = t.local.createTitle;

    let active = true;
    void send({ kind: "local-status" }).then((result) => {
      if (!active) return;
      setState(result.ok && result.kind === "local-status" && result.local.exists ? "exists" : "form");
    });
    return () => {
      active = false;
    };
  }, []);

  const submit = async (): Promise<void> => {
    if (password !== confirm) {
      setError(t.passwordsMismatch);
      return;
    }

    setBusy(true);
    setError(null);

    const result = await send({ kind: "local-create", masterPassword: password });

    setPassword("");
    setConfirm("");
    setBusy(false);

    if (!result.ok) {
      if (result.error === "local-vault-exists") setState("exists");
      else setError(describeError(t, result));
      return;
    }

    setState("created");
  };

  if (state === "checking") return null;

  if (state === "created" || state === "exists") {
    return (
      <div className="space-y-4 text-sm">
        <h1 className="text-xl font-semibold text-stone-900">
          {state === "created" ? t.local.createdTitle : t.local.createTitle}
        </h1>
        <p className="text-stone-700">{state === "created" ? t.local.createdBody : t.local.existsNote}</p>
        <button
          type="button"
          onClick={() => { window.close(); }}
          className="rounded-full bg-brand-400 px-3 py-1.5 font-medium text-brand-950 hover:bg-brand-300"
        >
          {t.closePage}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <h1 className="text-xl font-semibold text-stone-900">{t.local.createTitle}</h1>
      <p className="text-stone-700">{t.local.createSubtitle}</p>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
        <strong>{t.local.warnTitle}</strong>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>{t.local.warnForgot}</li>
          <li>{t.local.warnRemove}</li>
          <li>{t.local.warnSeparate}</li>
          <li>{t.local.warnSync}</li>
        </ul>
      </div>

      <PasswordInput placeholder={t.local.passwordHint(MIN_PASSWORD_LENGTH)} value={password} onChange={setPassword} />
      <PasswordInput placeholder={t.local.confirmLabel} value={confirm} onChange={setConfirm} />

      <label className="flex items-start gap-2 text-stone-700">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => { setAcknowledged(event.target.checked); }}
          className="mt-1"
        />
        <span>{t.local.acknowledge}</span>
      </label>

      {error !== null && <ErrorBox text={error} />}

      <button
        type="button"
        onClick={() => { void submit(); }}
        disabled={busy || !acknowledged || password.length < MIN_PASSWORD_LENGTH || confirm === ""}
        className={primaryClass}
      >
        {busy ? t.local.createBusy : t.local.createSubmit}
      </button>
    </div>
  );
};

export const ChangeLocalPasswordPage = () => {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"checking" | "form" | "locked" | "changed">("checking");

  useEffect(() => {
    document.title = t.local.changeTitle;

    let active = true;
    void send({ kind: "status" }).then((result) => {
      if (!active) return;
      setState(result.ok && result.kind === "status" && result.mode === "local" ? "form" : "locked");
    });
    return () => {
      active = false;
    };
  }, []);

  const submit = async (): Promise<void> => {
    if (next !== confirm) {
      setError(t.passwordsMismatch);
      return;
    }

    setBusy(true);
    setError(null);

    const result = await send({ kind: "local-change-password", current, next });

    setCurrent("");
    setNext("");
    setConfirm("");
    setBusy(false);

    if (!result.ok) {
      if (result.error === "session-expired") setState("locked");
      else setError(describeError(t, result));
      return;
    }

    setState("changed");
  };

  if (state === "checking") return null;

  if (state !== "form") {
    return (
      <div className="space-y-4 text-sm">
        <h1 className="text-xl font-semibold text-stone-900">{t.local.changeTitle}</h1>
        <p className="text-stone-700">{state === "changed" ? t.local.changed : t.local.changeNeedsUnlock}</p>
        <button
          type="button"
          onClick={() => { window.close(); }}
          className="rounded-full bg-brand-400 px-3 py-1.5 font-medium text-brand-950 hover:bg-brand-300"
        >
          {t.closePage}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <h1 className="text-xl font-semibold text-stone-900">{t.local.changeTitle}</h1>
      <p className="text-stone-700">{t.local.changeBody}</p>

      <PasswordInput placeholder={t.local.currentPassword} value={current} onChange={setCurrent} />
      <PasswordInput placeholder={t.local.newPassword(MIN_PASSWORD_LENGTH)} value={next} onChange={setNext} />
      <PasswordInput placeholder={t.local.confirmNew} value={confirm} onChange={setConfirm} />

      {error !== null && <ErrorBox text={error} />}

      <button
        type="button"
        onClick={() => { void submit(); }}
        disabled={
          busy || current.length < MIN_PASSWORD_LENGTH || next.length < MIN_PASSWORD_LENGTH || confirm === ""
        }
        className={primaryClass}
      >
        {busy ? t.local.changeBusy : t.local.changeSubmit}
      </button>
    </div>
  );
};
