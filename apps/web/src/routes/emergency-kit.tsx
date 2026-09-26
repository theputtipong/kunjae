import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { takeEmergencyKit } from "@kunjae/client-core";
import { Button, Callout, Card } from "../ui/primitives.tsx";
import { useT } from "../i18n/index.ts";

export const EmergencyKitPage = () => {
  const navigate = useNavigate();
  const t = useT();

  const [kit] = useState(() => takeEmergencyKit());
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (kit === null) void navigate({ to: "/" });
  }, [kit, navigate]);

  if (kit === null) return null;

  const download = (): void => {
    const content = [
      "Kunjae Emergency Kit",
      "",
      t.kit.fileEmail(kit.email),
      `Secret Key: ${kit.secretKey}`,
      "",
      t.kit.fileKeepSafe,
      t.kit.fileLoseBoth,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "kunjae-emergency-kit.txt";
    anchor.click();

    URL.revokeObjectURL(url);
  };

  const copy = (): void => {
    void navigator.clipboard.writeText(kit.secretKey).then(() => {
      setCopied(true);
    });
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold text-brand-900">{t.kit.title}</h1>
        <p className="text-sm text-stone-600">{t.kit.subtitle}</p>
      </header>

      <Callout tone="warning">
        {t.kit.warning}
      </Callout>

      <Card>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-stone-500">{t.common.email}</p>
            <p className="text-sm text-stone-900">{kit.email}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-stone-500">Secret Key</p>
            <p
              translate="no"
              className="mt-1 rounded-lg bg-stone-100 px-3 py-2 font-mono text-sm break-all text-stone-900"
            >
              {kit.secretKey}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={download}>
              {t.kit.download}
            </Button>
            <Button variant="ghost" onClick={copy}>
              {copied ? t.common.copied : t.common.copy}
            </Button>
          </div>

          {copied && (
            <Callout tone="info">
              {t.kit.clipboardNote}
            </Callout>
          )}
        </div>
      </Card>

      <Card>
        <label className="flex items-start gap-3 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => { setConfirmed(event.target.checked); }}
            className="mt-1"
          />
          <span>{t.kit.confirm}</span>
        </label>

        <div className="mt-4">
          <Button
            disabled={!confirmed}
            onClick={() => {
              void navigate({ to: "/vault" });
            }}
          >
            {t.kit.goToVault}
          </Button>
        </div>
      </Card>
    </div>
  );
};
