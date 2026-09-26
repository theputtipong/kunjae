import { useState } from "react";
import { Link } from "@tanstack/react-router";

import {
  changeLocalPassword,
  changeMasterPassword,
  deleteMyAccount,
  MIN_LOCAL_PASSWORD_LENGTH,
  revokeOtherSessions,
} from "@kunjae/client-core";
import {
  buildVaultExport,
  decryptExport,
  getDefaultVaultId,
  importVaultExport,
  encryptExport,
  getAllItemsForExport,
  getVaultNamesForExport,
  MIN_EXPORT_PASSWORD_LENGTH,
  vaultExportFileName,
} from "@kunjae/client-core";
import { errorMessage } from "@kunjae/client-core";
import { lockSession } from "@kunjae/client-core";
import { useSession } from "../session/use-session.ts";
import { clearStore, getWrappedVaults } from "@kunjae/client-core";
import { Button, Callout, Card, Field } from "../ui/primitives.tsx";
import { RequireUnlocked } from "./require-unlocked.tsx";
import { useLang, useT } from "../i18n/index.ts";
import { KunjaeMark } from "../ui/kunjae-mark.tsx";
import { SupportLink } from "../ui/preferences.tsx";
import { DeleteLocalVaultForm, MigrateLocalCard } from "../ui/local-vault.tsx";
import { useLocalPresence } from "../session/local-presence.ts";

const SettingsScreen = () => {
  const session = useSession();
  const lang = useLang();
  const t = useT();

  const [currentMasterPassword, setCurrent] = useState("");
  const [secretKeyText, setSecretKey] = useState("");
  const [newMasterPassword, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (newMasterPassword !== confirm) {
      setError(t.settings.mismatch);
      return;
    }

    setBusy(true);
    setError(null);
    setDone(false);

    const result = await changeMasterPassword({
      currentMasterPassword,
      secretKeyText,
      newMasterPassword,
      wrappedVaults: getWrappedVaults(),
      nowMs: Date.now(),
    });

    if (!result.ok) {
      setError(errorMessage(result.error, lang));
      setBusy(false);
      return;
    }

    setCurrent("");
    setSecretKey("");
    setNext("");
    setConfirm("");
    setDone(true);
    setBusy(false);
  };

  if (session.mode === "local") return <LocalSettingsScreen />;

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-brand-900">{t.settings.title}</h1>

      <Card>
        <div className="space-y-1 text-sm">
          <p className="font-medium text-stone-900">{t.settings.account}</p>
          <p className="text-stone-600">{session.email ?? "—"}</p>
        </div>
      </Card>

      <Card>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <h2 className="text-lg font-semibold text-stone-900">{t.settings.changeTitle}</h2>

          <Callout tone="warning">
            {t.settings.changeWarning}
          </Callout>

          <Field
            label={t.settings.currentMasterPassword}
            type="password"
            value={currentMasterPassword}
            onChange={setCurrent}
            sensitive
          />

          <Field
            label="Secret Key"
            value={secretKeyText}
            onChange={setSecretKey}
            placeholder="K1-UUUUUU-UUUUU-UUUUU-UUUUU-UUUUU"
            hint={t.settings.secretKeyHint}
            sensitive
          />

          <Field
            label={t.settings.newMasterPassword}
            type="password"
            value={newMasterPassword}
            onChange={setNext}
            hint={t.settings.newMasterPasswordHint}
            sensitive
          />

          <Field
            label={t.settings.confirmNew}
            type="password"
            value={confirm}
            onChange={setConfirm}
            sensitive
          />

          {error !== null && <Callout tone="danger">{error}</Callout>}
          {done && <Callout tone="success">{t.settings.changed}</Callout>}

          <Button type="submit" disabled={busy}>
            {busy ? t.settings.changing : t.settings.changeSubmit}
          </Button>
        </form>
      </Card>

      <LeftoverLocalVaultCard />

      <RevokeSessionsCard />

      <ExportCard email={session.email ?? ""} />

      <VerifyExportCard />

      <ImportCard />

      <DeleteAccountCard />

      <AboutCard />

      <LockNowCard />
    </div>
  );
};

const LockNowCard = () => {
  const t = useT();

  return (
    <Card>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-900">{t.settings.lockNow}</h2>
        <p className="text-sm text-stone-600">
          {t.settings.lockNowBody}
        </p>
        <Button
          variant="danger"
          onClick={() => {
            lockSession();
            clearStore();
          }}
        >
          {t.common.lock}
        </Button>
      </div>
    </Card>
  );
};

const LocalSettingsScreen = () => {
  const t = useT();

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-brand-900">{t.settings.title}</h1>

      <Card>
        <section aria-labelledby="this-device-title" className="space-y-3">
          <h2 id="this-device-title" className="text-lg font-semibold text-stone-900">
            {t.local.settingsTitle}
          </h2>
          <p className="text-sm text-stone-600">{t.local.settingsBody}</p>
          <Callout tone="warning">{t.local.exportReminder}</Callout>
        </section>
      </Card>

      <ChangeLocalPasswordCard />

      <Card>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">{t.local.syncTitle}</h2>
          <p className="text-sm text-stone-600">{t.local.syncBody}</p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/sign-in"
              className="rounded-full bg-brand-400 px-5 py-2.5 text-sm font-medium text-brand-950 hover:bg-brand-300"
            >
              {t.local.bannerLink}
            </Link>
            <Link
              to="/sign-up"
              className="rounded-full border border-stone-300 bg-surface px-5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              {t.local.createAccount}
            </Link>
          </div>
        </div>
      </Card>

      <ExportCard email="" />

      <VerifyExportCard />

      <ImportCard />

      <Card>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-red-700">{t.local.deleteTitle}</h2>
          <Callout tone="danger">{t.local.deleteBody}</Callout>
          <DeleteLocalVaultForm />
        </div>
      </Card>

      <AboutCard />

      <LockNowCard />
    </div>
  );
};

const ChangeLocalPasswordCard = () => {
  const lang = useLang();
  const t = useT();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (next !== confirm) {
      setError(t.settings.mismatch);
      return;
    }

    setBusy(true);
    setError(null);
    setDone(false);

    const result = await changeLocalPassword({ current, next });

    setCurrent("");
    setBusy(false);

    if (!result.ok) {
      setError(errorMessage(result.error, lang));
      return;
    }

    setNext("");
    setConfirm("");
    setDone(true);
  };

  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h2 className="text-lg font-semibold text-stone-900">{t.local.changeTitle}</h2>
        <p className="text-sm text-stone-600">{t.local.changeBody}</p>

        <Field
          label={t.local.currentPassword}
          type="password"
          value={current}
          onChange={setCurrent}
          sensitive
        />

        <Field
          label={t.local.newPassword}
          type="password"
          value={next}
          onChange={setNext}
          hint={t.local.newPasswordHint}
          sensitive
        />

        <Field
          label={t.local.confirmNew}
          type="password"
          value={confirm}
          onChange={setConfirm}
          sensitive
        />

        {error !== null && <Callout tone="danger">{error}</Callout>}
        {done && <Callout tone="success">{t.local.changed}</Callout>}

        <Button
          type="submit"
          disabled={busy || current === "" || next.length < MIN_LOCAL_PASSWORD_LENGTH}
        >
          {busy ? t.local.changeBusy : t.local.changeSubmit}
        </Button>
      </form>
    </Card>
  );
};

const LeftoverLocalVaultCard = () => {
  const t = useT();
  const presence = useLocalPresence();

  if (presence !== "present") return null;

  return (
    <Card>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-900">{t.local.migrateSettingsTitle}</h2>
        <MigrateLocalCard dismissible={false} />
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-red-700">{t.local.deleteTitle}</summary>
          <div className="mt-3 space-y-3">
            <Callout tone="danger">{t.local.deleteBody}</Callout>
            <DeleteLocalVaultForm />
          </div>
        </details>
      </div>
    </Card>
  );
};

const ExportCard = ({ email }: { readonly email: string }) => {
  const lang = useLang();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [encrypt, setEncrypt] = useState(true);
  const [exportPassword, setExportPassword] = useState("");

  const download = async (): Promise<void> => {
    setBusy(true);
    setError(null);

    const exportedAt = new Date().toISOString();

    const plain = buildVaultExport({
      email,
      items: getAllItemsForExport(),
      vaultNames: getVaultNamesForExport(),
      exportedAt,
      lang,
    });

    let content = plain;

    if (encrypt) {
      const sealed = await encryptExport(plain, exportPassword, lang);
      if (!sealed.ok) {
        setError(t.settings.exportEncryptFailed(MIN_EXPORT_PASSWORD_LENGTH));
        setBusy(false);
        return;
      }
      content = JSON.stringify(sealed.value, null, 2);
    }

    setExportPassword("");

    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = vaultExportFileName(exportedAt);
    anchor.click();

    URL.revokeObjectURL(url);
    setDone(true);
    setBusy(false);
  };

  return (
    <Card>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-900">{t.settings.exportTitle}</h2>
        <p className="text-sm text-stone-600">
          {t.settings.exportBody}
        </p>

        {!open ? (
          <Button variant="ghost" onClick={() => { setOpen(true); }}>
            {t.settings.exportOpen}
          </Button>
        ) : (
          <>
            <label className="flex items-start gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={encrypt}
                onChange={(event) => { setEncrypt(event.target.checked); }}
                className="mt-1"
              />
              <span>{t.settings.exportEncrypt}</span>
            </label>

            {encrypt ? (
              <>
                <Field
                  label={t.settings.exportPassword}
                  type="password"
                  value={exportPassword}
                  onChange={setExportPassword}
                  sensitive
                  hint={t.settings.exportPasswordHint(MIN_EXPORT_PASSWORD_LENGTH)}
                />
                <Callout tone="info">
                  {t.settings.exportKdfNote}
                  <br />
                  {t.settings.exportLocalNote}
                </Callout>
              </>
            ) : (
              <Callout tone="danger">
                <strong>{t.settings.exportPlainTitle}</strong>
                {t.settings.exportPlainBody}
                <br />
                {t.settings.exportLocalNote}
              </Callout>
            )}

            {error !== null && <Callout tone="danger">{error}</Callout>}

            <div className="flex gap-2">
              <Button
                variant={encrypt ? "primary" : "danger"}
                disabled={busy || (encrypt && exportPassword.length < MIN_EXPORT_PASSWORD_LENGTH)}
                onClick={() => { void download(); }}
              >
                {busy ? t.settings.encrypting : encrypt ? t.settings.downloadEncrypted : t.settings.downloadPlain}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setDone(false);
                  setExportPassword("");
                  setError(null);
                }}
              >
                {t.common.cancel}
              </Button>
            </div>
            {done && (
              <Callout tone="info">
                {encrypt
                  ? t.settings.downloadedEncrypted
                  : t.settings.downloadedPlain}
              </Callout>
            )}
          </>
        )}
      </div>
    </Card>
  );
};

const RevokeSessionsCard = () => {
  const lang = useLang();
  const t = useT();
  const [masterPassword, setMasterPassword] = useState("");
  const [secretKeyText, setSecretKey] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);

    const result = await revokeOtherSessions({
      currentMasterPassword: masterPassword,
      secretKeyText,
      nowMs: Date.now(),
    });

    setMasterPassword("");
    setSecretKey("");
    setBusy(false);

    if (!result.ok) {
      setError(errorMessage(result.error, lang));
      return;
    }

    setDone(true);
    setOpen(false);
  };

  return (
    <Card>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-900">{t.settings.revokeTitle}</h2>
        <p className="text-sm text-stone-600">
          {t.settings.revokeBody}
          <strong>{t.settings.revokeExcept}</strong>
        </p>

        {done && <Callout tone="success">{t.settings.revoked}</Callout>}

        {!open ? (
          <Button variant="ghost" onClick={() => { setOpen(true); setDone(false); }}>
            {t.settings.revokeTitle}
          </Button>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <Field
              label="Master Password"
              type="password"
              value={masterPassword}
              onChange={setMasterPassword}
              sensitive
            />
            <Field
              label="Secret Key"
              value={secretKeyText}
              onChange={setSecretKey}
              sensitive
              hint={t.settings.proveOwnerHint}
            />

            {error !== null && <Callout tone="danger">{error}</Callout>}

            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? t.settings.revoking : t.common.confirm}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setMasterPassword("");
                  setSecretKey("");
                  setError(null);
                }}
              >
                {t.common.cancel}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
};

const ImportCard = () => {
  const t = useT();
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (file: File): Promise<void> => {
    const vaultId = getDefaultVaultId();
    if (vaultId === null) {
      setError(t.settings.noVaultToImport);
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);

    const imported = await importVaultExport({
      document: await file.text(),
      password,
      vaultId,
      nowMs: Date.now(),
    });

    setPassword("");
    setBusy(false);

    if (!imported.ok) {
      setError(t.settings.importFailed);
      return;
    }

    const { added, skipped, invalid, failed } = imported.value;
    setResult(t.settings.importResult({ added, skipped, invalid, failed }));
  };

  return (
    <Card>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-900">{t.settings.importTitle}</h2>
        <p className="text-sm text-stone-600">
          {t.settings.importBodyBefore}
          <strong>{t.settings.importBodyStrong}</strong>
          {t.settings.importBodyAfter}
        </p>

        <Field
          label={t.settings.importPassword}
          type="password"
          value={password}
          onChange={setPassword}
          sensitive
        />

        <label className="block space-y-1 text-sm font-medium text-stone-700">
          <span>{t.settings.importChoose}</span>
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file !== undefined) void run(file);
              event.target.value = "";
            }}
            className="block w-full font-normal text-stone-700"
          />
        </label>

        {busy && <Callout tone="info">{t.settings.importing}</Callout>}
        {result !== null && <Callout tone="success">{result}</Callout>}
        {error !== null && <Callout tone="danger">{error}</Callout>}
      </div>
    </Card>
  );
};

const VerifyExportCard = () => {
  const t = useT();
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const verify = async (file: File): Promise<void> => {
    setBusy(true);
    setError(null);
    setResult(null);

    const text = await file.text();
    const opened = await decryptExport(text, password);

    setPassword("");
    setBusy(false);

    if (!opened.ok) {
      setError(t.settings.verifyFailed);
      return;
    }

    try {
      const parsed = JSON.parse(opened.value) as { readonly items?: readonly unknown[] };
      setResult(t.settings.verifyOk(parsed.items?.length ?? 0));
    } catch {
      setError(t.settings.verifyUnknown);
    }
  };

  return (
    <Card>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-900">{t.settings.verifyTitle}</h2>
        <p className="text-sm text-stone-600">
          {t.settings.verifyBody}
        </p>

        <Field
          label={t.settings.filePassword}
          type="password"
          value={password}
          onChange={setPassword}
          sensitive
        />

        <label className="block space-y-1 text-sm font-medium text-stone-700">
          <span>{t.settings.verifyChoose}</span>
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy || password === ""}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file !== undefined) void verify(file);
              event.target.value = "";
            }}
            className="block w-full font-normal text-stone-700"
          />
        </label>

        {busy && <Callout tone="info">{t.settings.verifying}</Callout>}
        {result !== null && <Callout tone="success">{result}</Callout>}
        {error !== null && <Callout tone="danger">{error}</Callout>}
      </div>
    </Card>
  );
};

const DeleteAccountCard = () => {
  const lang = useLang();
  const t = useT();
  const confirmPhrase = t.settings.deleteConfirmPhrase;
  const [masterPassword, setMasterPassword] = useState("");
  const [secretKeyText, setSecretKey] = useState("");
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);

    const result = await deleteMyAccount({
      currentMasterPassword: masterPassword,
      secretKeyText,
      nowMs: Date.now(),
    });

    setMasterPassword("");
    setSecretKey("");
    setPhrase("");

    if (!result.ok) {
      setError(errorMessage(result.error, lang));
      setBusy(false);
      return;
    }

    setBusy(false);
  };

  return (
    <Card>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-red-700">{t.settings.deleteTitle}</h2>
        <Callout tone="danger">
          {t.settings.deleteBody}
          <strong>{t.settings.deleteBodyStrong}</strong>
          {t.settings.deleteBodyAfter}
        </Callout>

        {!open ? (
          <Button variant="ghost" onClick={() => { setOpen(true); }}>
            {t.settings.deleteOpen}
          </Button>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <Field
              label="Master Password"
              type="password"
              value={masterPassword}
              onChange={setMasterPassword}
              sensitive
            />
            <Field
              label="Secret Key"
              value={secretKeyText}
              onChange={setSecretKey}
              sensitive
              hint={t.settings.proveOwnerHint}
            />
            <Field
              label={t.settings.typeToConfirm(confirmPhrase)}
              value={phrase}
              onChange={setPhrase}
            />

            {error !== null && <Callout tone="danger">{error}</Callout>}

            <div className="flex gap-2">
              <Button
                type="submit"
                variant="danger"
                disabled={busy || phrase !== confirmPhrase}
              >
                {busy ? t.settings.deleting : t.settings.deleteSubmit}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setMasterPassword("");
                  setSecretKey("");
                  setPhrase("");
                  setError(null);
                }}
              >
                {t.common.cancel}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
};

const AboutCard = () => {
  const t = useT();

  return (
    <Card>
      <section aria-labelledby="about-title" className="space-y-3">
        <h2 id="about-title" className="text-lg font-semibold text-stone-900">
          {t.about.title}
        </h2>
        <div className="flex items-center gap-3">
          <KunjaeMark size={40} />
          <div className="text-sm">
            <p className="font-medium text-stone-900">Kunjae</p>
            <p className="text-xs text-stone-500">{t.about.version(__APP_VERSION__)}</p>
          </div>
        </div>
        <p className="text-sm text-stone-600">{t.about.description}</p>
        <p className="text-sm">
          <Link to="/welcome" className="font-medium text-brand-700 hover:underline">
            {t.onboarding.open}
          </Link>
        </p>
        <p className="text-xs text-stone-500">
          <SupportLink />
        </p>
      </section>
    </Card>
  );
};

export const SettingsPage = () => (
  <RequireUnlocked>
    <SettingsScreen />
  </RequireUnlocked>
);
