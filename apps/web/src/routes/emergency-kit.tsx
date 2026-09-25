import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { takeEmergencyKit } from "@kunjae/client-core";
import { Button, Callout, Card } from "../ui/primitives.tsx";

export const EmergencyKitPage = () => {
  const navigate = useNavigate();

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
      `อีเมล: ${kit.email}`,
      `Secret Key: ${kit.secretKey}`,
      "",
      "เก็บเอกสารนี้ไว้ในที่ปลอดภัย และอย่าเก็บไว้ที่เดียวกับรหัสผ่านหลัก",
      "ถ้าทำหายทั้งสองอย่าง จะไม่มีใครกู้ข้อมูลของคุณได้เลย",
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
        <h1 className="text-2xl font-semibold text-brand-900">Emergency Kit ของคุณ</h1>
        <p className="text-sm text-stone-600">แสดงครั้งเดียวเท่านั้น — บันทึกก่อนไปต่อ</p>
      </header>

      <Callout tone="warning">
        Secret Key นี้ไม่ได้ถูกส่งไปที่เซิร์ฟเวอร์และไม่ได้ถูกเก็บไว้ในเครื่อง
        ถ้าปิดหน้านี้โดยไม่บันทึก คุณจะเข้าใช้งานจากเครื่องอื่นไม่ได้อีกเลย
      </Callout>

      <Card>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-stone-500">อีเมล</p>
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
              ดาวน์โหลดเป็นไฟล์
            </Button>
            <Button variant="ghost" onClick={copy}>
              {copied ? "คัดลอกแล้ว" : "คัดลอก"}
            </Button>
          </div>

          {copied && (
            <Callout tone="info">
              ค่านี้อยู่ในคลิปบอร์ดของระบบแล้ว ซึ่งอยู่นอกความคุ้มครองของแอป —
              แนะนำให้วางลงที่เก็บที่ปลอดภัยแล้วล้างคลิปบอร์ด
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
          <span>
            ฉันบันทึก Secret Key ไว้ในที่ปลอดภัยแล้ว และเข้าใจว่าไม่มีใครกู้คืนให้ได้
          </span>
        </label>

        <div className="mt-4">
          <Button
            disabled={!confirmed}
            onClick={() => {
              void navigate({ to: "/vault" });
            }}
          >
            ไปที่ vault ของฉัน
          </Button>
        </div>
      </Card>
    </div>
  );
};
