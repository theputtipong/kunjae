import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import { pull, signUp } from "@kunjae/client-core";
import { holdEmergencyKit } from "@kunjae/client-core";
import { errorMessage } from "@kunjae/client-core";
import { Button, Callout, Card, Field } from "../ui/primitives.tsx";

export const SignUpPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (masterPassword !== confirm) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }

    setBusy(true);
    setError(null);

    const result = await signUp({ email, masterPassword, nowMs: Date.now() });

    if (!result.ok) {
      setError(errorMessage(result.error));
      setBusy(false);
      return;
    }

    setMasterPassword("");
    setConfirm("");

    await pull(Date.now());

    holdEmergencyKit(result.value);
    await navigate({ to: "/emergency-kit" });
  };

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold text-brand-900">สมัครใช้งาน Kunjae</h1>
      </header>

      <Callout tone="warning">
        <strong>อ่านก่อนสมัคร:</strong> เราไม่มีทางกู้รหัสผ่านหลักของคุณได้
        เพราะเราไม่เคยเห็นมันเลย ถ้าลืมรหัสผ่านหลักหรือทำ Secret Key หาย
        ข้อมูลทั้งหมดจะเปิดไม่ได้อีกตลอดไป
      </Callout>

      <Card>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Field label="อีเมล" type="email" value={email} onChange={setEmail} autoFocus />

          <Field
            label="Master Password"
            type="password"
            value={masterPassword}
            onChange={setMasterPassword}
            hint="อย่างน้อย 12 ตัวอักษร — วลียาวที่จำได้แข็งแรงกว่ารหัสสั้นที่ซับซ้อน"
            sensitive
          />

          <Field
            label="พิมพ์ Master Password อีกครั้ง"
            type="password"
            value={confirm}
            onChange={setConfirm}
            sensitive
          />

          {error !== null && <Callout tone="danger">{error}</Callout>}

          <Button type="submit" disabled={busy}>
            {busy ? "กำลังสร้างกุญแจ…" : "สมัครสมาชิก"}
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-stone-600">
        มีบัญชีแล้ว?{" "}
        <Link to="/" className="font-medium text-brand-700 hover:underline">
          ปลดล็อก
        </Link>
      </p>
    </div>
  );
};
