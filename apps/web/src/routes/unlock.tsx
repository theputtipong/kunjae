import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import { unlock } from "@kunjae/client-core";
import { errorMessage } from "@kunjae/client-core";
import { pull } from "@kunjae/client-core";
import { Button, Callout, Card, Field } from "../ui/primitives.tsx";
import { KunjaeMark } from "../ui/kunjae-mark.tsx";

export const UnlockPage = () => {
  const navigate = useNavigate();
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
      setError(errorMessage(result.error));
      setBusy(false);
      return;
    }

    setMasterPassword("");
    setSecretKeyText("");

    await pull(nowMs);

    await navigate({ to: "/vault" });
  };

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <header className="space-y-3 pt-6 text-center">
        <div className="flex justify-center">
          <KunjaeMark size={80} label="Kunjae — ล็อกอยู่" />
        </div>
        <h1 className="text-2xl font-semibold text-stone-900">ปลดล็อกคลังข้อมูลของคุณ</h1>
        <p className="text-sm text-stone-600">ทุกการถอดรหัสเกิดขึ้นในเบราว์เซอร์นี้เท่านั้น</p>
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
            label="อีเมล"
            type="email"
            value={email}
            onChange={setEmail}
            hint="อีเมลที่ใช้สมัคร"
            autoFocus
          />

          <fieldset className="space-y-4 rounded-2xl bg-stone-100 p-4">
            <legend className="float-left mb-1 flex w-full items-center gap-2 text-sm font-semibold text-stone-900">
              <KunjaeMark size={18} tile={false} /> กุญแจสองชิ้นของคุณ
            </legend>

            <Field
              label="Master Password"
              type="password"
              value={masterPassword}
              onChange={setMasterPassword}
              hint="รหัสผ่านที่คุณตั้งเองตอนสมัคร"
              sensitive
            />

            <Field
              label="Secret Key"
              value={secretKeyText}
              onChange={setSecretKeyText}
              placeholder="K1-UUUUUU-UUUUU-UUUUU-UUUUU-UUUUU"
              hint="อยู่ใน Emergency Kit ที่ได้ตอนสมัคร — วางได้เลย ขีดและช่องว่างไม่สำคัญ"
              sensitive
            />
          </fieldset>

          {error !== null && <Callout tone="danger">{error}</Callout>}

          <div className="grid">
            <Button type="submit" disabled={busy}>
              {busy ? "กำลังคำนวณกุญแจ…" : "🔒 ปลดล็อก"}
            </Button>
          </div>

          {busy && (
            <p className="text-xs text-stone-500">
              Argon2id กำลังทำงาน — ความช้านี้คือสิ่งที่ทำให้การเดารหัสผ่านแพงเกินคุ้ม
            </p>
          )}
        </form>
      </Card>

      <details className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
        <summary className="cursor-pointer font-medium text-brand-700">Secret Key คืออะไร?</summary>
        <div className="mt-2 space-y-2">
          <p>
            รหัสยาว 128 บิตที่ระบบสุ่มให้ตอนสมัคร และแสดงใน Emergency Kit ครั้งเดียว — ไม่ต้องจำ แต่ต้องเก็บไว้
          </p>
          <p>
            ต้องใช้คู่กับ Master Password เสมอ ถ้ามีคนขโมยข้อมูลจาก server แล้วเดารหัสผ่านถูก ก็ยังเปิดไม่ได้
            เพราะ Secret Key ไม่เคยถูกส่งขึ้น server
          </p>
          <p className="font-medium text-red-800">ลืม Master Password หรือทำ Secret Key หาย = ข้อมูลหายถาวร ไม่มีใครกู้ให้ได้</p>
        </div>
      </details>

      <p className="text-center text-sm text-stone-600">
        ยังไม่มีบัญชี?{" "}
        <Link to="/sign-up" className="font-medium text-brand-700 hover:underline">
          สมัครสมาชิก
        </Link>
      </p>
    </div>
  );
};
