import { useCallback, useEffect, useState } from "react";
import { browser } from "#imports";

import type { ItemBrief, Request, Response } from "../../messaging.ts";
import { KunjaeMark } from "../../kunjae-mark.tsx";

const send = async (request: Request): Promise<Response> => {
  const response: unknown = await browser.runtime.sendMessage(request);

  if (typeof response !== "object" || response === null || !("ok" in response)) {
    return { ok: false, message: "ไม่ได้รับคำตอบจากส่วนขยาย" };
  }

  return response as Response;
};

export const Popup = () => {
  const [unlocked, setUnlocked] = useState(false);
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

      setUnlocked(status.unlocked);
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

    if (!result.ok) setMessage(result.message);
    else refresh();

    setBusy(false);
  };

  const copyPassword = async (itemId: string): Promise<void> => {
    const result = await send({ kind: "reveal", itemId });
    if (!result.ok || result.kind !== "reveal") {
      setMessage(result.ok ? "ไม่พบรหัสผ่าน" : result.message);
      return;
    }

    await navigator.clipboard.writeText(result.password);
    setMessage("คัดลอกแล้ว — คลิปบอร์ดอยู่นอกความคุ้มครองของส่วนขยาย");
  };

  const copyTotp = async (itemId: string): Promise<void> => {
    const result = await send({ kind: "totp", itemId });
    if (!result.ok || result.kind !== "totp") {
      setMessage(result.ok ? "ขอรหัสไม่สำเร็จ" : result.message);
      return;
    }

    await navigator.clipboard.writeText(result.code);
    setMessage(`คัดลอกรหัสครั้งเดียวแล้ว — ใช้ได้อีก ${String(result.secondsRemaining)} วินาที`);
  };

  const openEditor = async (itemId: string | null): Promise<void> => {
    if (itemId === null) {
      setDraft({ itemId: null, title: "", username: "", password: "", url: "", totpSecret: "" });
      return;
    }

    const result = await send({ kind: "load-for-edit", itemId });
    if (!result.ok || result.kind !== "editable") {
      setMessage(result.ok ? "โหลดรายการไม่สำเร็จ" : result.message);
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
      setMessage(result.message);
      return;
    }

    closeEditor();
    setMessage("บันทึกแล้ว");
    refresh();
  };

  const fillTotp = async (itemId: string): Promise<void> => {
    const result = await send({ kind: "fill-totp", itemId });
    setMessage(result.ok ? "เติมรหัส 2FA ให้แล้ว" : result.message);
  };

  const fill = async (itemId: string): Promise<void> => {
    const result = await send({ kind: "fill", itemId });
    setMessage(result.ok ? "เติมข้อมูลให้แล้ว" : result.message);
  };

  if (!unlocked) {
    return (
      <div className="space-y-3 p-4 text-sm">
        <h1 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <KunjaeMark size={28} unlocked={unlocked} />
          Kunjae
        </h1>

        <input
          className="w-full rounded border border-stone-300 px-2 py-1"
          placeholder="อีเมล"
          type="email"
          value={email}
          onChange={(event) => { setEmail(event.target.value); }}
        />

        <input
          className="w-full rounded border border-stone-300 px-2 py-1"
          placeholder="Master Password"
          type="password"
          autoComplete="one-time-code"
          spellCheck={false}
          translate="no"
          value={masterPassword}
          onChange={(event) => { setMasterPassword(event.target.value); }}
        />

        <input
          className="w-full rounded border border-stone-300 px-2 py-1"
          placeholder="Secret Key"
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
          {busy ? "กำลังคำนวณกุญแจ…" : "ปลดล็อก"}
        </button>

        {message !== null && <p className="text-xs text-red-700">{message}</p>}

        <button
          type="button"
          onClick={() => {
            void browser.tabs.create({ url: browser.runtime.getURL("/signup.html") });
          }}
          className="w-full rounded border border-stone-300 px-3 py-1.5 text-xs"
        >
          ยังไม่มีบัญชี — สมัครใช้งาน
        </button>

        <p className="text-[11px] leading-snug text-stone-500">
          กุญแจอยู่ในหน่วยความจำของส่วนขยายเท่านั้น และหายไปเองเมื่อเบราว์เซอร์
          ปิดส่วนขยายที่ไม่ได้ใช้งาน — เป็นการล็อกอัตโนมัติที่ได้มาจากข้อจำกัดของ MV3
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 text-sm">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <KunjaeMark size={28} unlocked={unlocked} />
          Kunjae
        </h1>
        <button
          type="button"
          onClick={() => {
            void send({ kind: "lock" }).then(refresh, refresh);
          }}
          className="rounded border border-stone-300 px-2 py-1 text-xs"
        >
          ล็อก
        </button>
      </div>

      {draft !== null ? (
        <div className="space-y-2">
          <p className="font-medium text-stone-900">
            {draft.itemId === null ? "รายการใหม่" : "แก้ไขรายการ"}
          </p>

          {(
            [
              ["ชื่อรายการ", "title", "text"],
              ["ชื่อผู้ใช้", "username", "text"],
              ["รหัสผ่าน", "password", "password"],
              ["เว็บไซต์", "url", "text"],
              ["ความลับ TOTP", "totpSecret", "password"],
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
              {busy ? "กำลังบันทึก…" : "บันทึก"}
            </button>
            <button
              type="button"
              onClick={closeEditor}
              className="rounded border border-stone-300 px-2 py-1 text-xs"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { void openEditor(null); }}
          className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
        >
          + เพิ่มรายการ
        </button>
      )}

      {items.length === 0 && draft === null && <p className="text-stone-600">ยังไม่มีรายการ</p>}

      <ul className={`max-h-80 space-y-2 overflow-y-auto ${draft === null ? "" : "hidden"}`}>
        {items.map((item) => (
          <li key={item.itemId} className="rounded border border-stone-200 p-2">
            <p className="font-medium text-stone-900">{item.title || "(ไม่มีชื่อ)"}</p>
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
                เติมในหน้านี้
              </button>
              <button
                type="button"
                onClick={() => { void copyPassword(item.itemId); }}
                className="rounded border border-stone-300 px-2 py-1 text-xs"
              >
                คัดลอกรหัสผ่าน
              </button>
              <button
                type="button"
                onClick={() => { void openEditor(item.itemId); }}
                className="rounded border border-stone-300 px-2 py-1 text-xs"
              >
                แก้ไข
              </button>
              {item.hasTotp && (
                <>
                  <button
                    type="button"
                    onClick={() => { void fillTotp(item.itemId); }}
                    className="rounded border border-stone-300 px-2 py-1 text-xs"
                  >
                    เติมรหัส 2FA
                  </button>
                  <button
                    type="button"
                    onClick={() => { void copyTotp(item.itemId); }}
                    className="rounded border border-stone-300 px-2 py-1 text-xs"
                  >
                    คัดลอกรหัส 2FA
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {message !== null && <p className="text-xs text-stone-700">{message}</p>}
    </div>
  );
};
