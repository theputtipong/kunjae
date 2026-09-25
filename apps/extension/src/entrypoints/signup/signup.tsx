import { useState } from "react";
import { browser } from "#imports";

import type { Request, Response } from "../../messaging.ts";

const send = async (request: Request): Promise<Response> => {
  const response: unknown = await browser.runtime.sendMessage(request);

  if (typeof response !== "object" || response === null || !("ok" in response)) {
    return { ok: false, message: "ไม่ได้รับคำตอบจากส่วนขยาย" };
  }

  return response as Response;
};

const MIN_PASSWORD_LENGTH = 12;

export const SignUpPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kit, setKit] = useState<{ readonly email: string; readonly secretKey: string } | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = async (): Promise<void> => {
    if (password !== confirm) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }

    setBusy(true);
    setError(null);

    const result = await send({ kind: "sign-up", email, masterPassword: password });

    setPassword("");
    setConfirm("");
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    if (result.kind !== "emergency-kit") {
      setError("คำตอบจากส่วนขยายไม่ถูกต้อง");
      return;
    }

    setKit({ email: result.email, secretKey: result.secretKey });
  };

  if (kit !== null) {
    return (
      <div className="space-y-4 text-sm">
        <h1 className="text-xl font-semibold text-stone-900">Emergency Kit ของคุณ</h1>

        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <strong>แสดงครั้งเดียวเท่านั้น</strong> — บันทึกก่อนปิดหน้านี้
          <br />
          ถ้าทำหายพร้อมกับลืมรหัสผ่านหลัก จะไม่มีใครเปิดข้อมูลของคุณได้อีกเลย
          รวมถึงผู้พัฒนา Kunjae
        </div>

        <div>
          <p className="text-xs font-medium text-stone-500">อีเมล</p>
          <p className="text-stone-900">{kit.email}</p>
        </div>

        <div>
          <p className="text-xs font-medium text-stone-500">Secret Key</p>
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
              `อีเมล: ${kit.email}`,
              `Secret Key: ${kit.secretKey}`,
              "",
              "เก็บเอกสารนี้ไว้ในที่ปลอดภัย และอย่าเก็บไว้ที่เดียวกับรหัสผ่านหลัก",
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
          ดาวน์โหลดเป็นไฟล์
        </button>

        <label className="flex items-start gap-2 text-stone-700">
          <input
            type="checkbox"
            checked={saved}
            onChange={(event) => { setSaved(event.target.checked); }}
            className="mt-1"
          />
          <span>ฉันบันทึก Secret Key ไว้ในที่ปลอดภัยแล้ว และเข้าใจว่าไม่มีใครกู้คืนให้ได้</span>
        </label>

        <button
          type="button"
          disabled={!saved}
          onClick={() => { window.close(); }}
          className="rounded-full bg-brand-400 px-3 py-1.5 font-medium text-brand-950 hover:bg-brand-300 disabled:bg-stone-200 disabled:text-stone-500"
        >
          ปิดหน้านี้
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <h1 className="text-xl font-semibold text-stone-900">สมัครใช้งาน Kunjae</h1>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
        <strong>อ่านก่อนสมัคร:</strong> เราไม่มีทางกู้รหัสผ่านหลักของคุณได้
        เพราะเราไม่เคยเห็นมันเลย ถ้าลืมรหัสผ่านหลักหรือทำ Secret Key หาย
        ข้อมูลทั้งหมดจะเปิดไม่ได้อีกตลอดไป
      </div>

      <input
        className="w-full rounded border border-stone-300 px-2 py-1.5"
        placeholder="อีเมล"
        type="email"
        value={email}
        onChange={(event) => { setEmail(event.target.value); }}
      />

      <input
        className="w-full rounded border border-stone-300 px-2 py-1.5"
        placeholder={`Master Password (อย่างน้อย ${String(MIN_PASSWORD_LENGTH)} ตัวอักษร)`}
        type="password"
        autoComplete="one-time-code"
        spellCheck={false}
        translate="no"
        value={password}
        onChange={(event) => { setPassword(event.target.value); }}
      />

      <input
        className="w-full rounded border border-stone-300 px-2 py-1.5"
        placeholder="พิมพ์ Master Password อีกครั้ง"
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
        {busy ? "กำลังสร้างกุญแจ…" : "สมัครสมาชิก"}
      </button>
    </div>
  );
};
