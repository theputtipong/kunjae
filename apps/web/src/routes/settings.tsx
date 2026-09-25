import { useState } from "react";

import { changeMasterPassword, deleteMyAccount, revokeOtherSessions } from "@kunjae/client-core";
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

const SettingsScreen = () => {
  const session = useSession();

  const [currentMasterPassword, setCurrent] = useState("");
  const [secretKeyText, setSecretKey] = useState("");
  const [newMasterPassword, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (newMasterPassword !== confirm) {
      setError("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน");
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
      setError(errorMessage(result.error));
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

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-brand-900">ตั้งค่า</h1>

      <Card>
        <div className="space-y-1 text-sm">
          <p className="font-medium text-stone-900">บัญชี</p>
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
          <h2 className="text-lg font-semibold text-stone-900">เปลี่ยน Master Password</h2>

          <Callout tone="warning">
            การเปลี่ยนรหัสผ่านจะห่อกุญแจของ vault ทุกใบใหม่ และทำให้
            อุปกรณ์อื่นทุกเครื่องหลุดออกจากระบบทันที
          </Callout>

          <Field
            label="Master Password เดิม"
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
            hint="ต้องกรอกเพื่อยืนยันว่าคุณถือ Emergency Kit อยู่จริง"
            sensitive
          />

          <Field
            label="Master Password ใหม่"
            type="password"
            value={newMasterPassword}
            onChange={setNext}
            hint="อย่างน้อย 12 ตัวอักษร"
            sensitive
          />

          <Field
            label="พิมพ์รหัสผ่านใหม่อีกครั้ง"
            type="password"
            value={confirm}
            onChange={setConfirm}
            sensitive
          />

          {error !== null && <Callout tone="danger">{error}</Callout>}
          {done && <Callout tone="success">เปลี่ยนรหัสผ่านหลักเรียบร้อยแล้ว</Callout>}

          <Button type="submit" disabled={busy}>
            {busy ? "กำลังคำนวณกุญแจและห่อใหม่…" : "เปลี่ยนรหัสผ่าน"}
          </Button>
        </form>
      </Card>

      <RevokeSessionsCard />

      <ExportCard email={session.email ?? ""} />

      <VerifyExportCard />

      <ImportCard />

      <DeleteAccountCard />

      <Card>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">ล็อกทันที</h2>
          <p className="text-sm text-stone-600">
            ล้างกุญแจและข้อมูลที่ถอดรหัสแล้วทั้งหมดออกจากหน่วยความจำ
          </p>
          <Button
            variant="danger"
            onClick={() => {
              lockSession();
              clearStore();
            }}
          >
            ล็อก
          </Button>
        </div>
      </Card>
    </div>
  );
};

const ExportCard = ({ email }: { readonly email: string }) => {
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
    });

    let content = plain;

    if (encrypt) {
      const sealed = await encryptExport(plain, exportPassword);
      if (!sealed.ok) {
        setError(`เข้ารหัสไม่สำเร็จ — รหัสผ่านต้องยาวอย่างน้อย ${String(MIN_EXPORT_PASSWORD_LENGTH)} ตัวอักษร`);
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
        <h2 className="text-lg font-semibold text-stone-900">ส่งออกข้อมูลทั้งหมด</h2>
        <p className="text-sm text-stone-600">
          ดาวน์โหลดรายการทั้งหมดเป็นไฟล์ JSON เพื่อเก็บสำรองหรือย้ายไปโปรแกรมอื่น
        </p>

        {!open ? (
          <Button variant="ghost" onClick={() => { setOpen(true); }}>
            ส่งออกข้อมูล
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
              <span>เข้ารหัสไฟล์ด้วยรหัสผ่านที่ตั้งใหม่ (แนะนำ)</span>
            </label>

            {encrypt ? (
              <>
                <Field
                  label="รหัสผ่านสำหรับไฟล์นี้"
                  type="password"
                  value={exportPassword}
                  onChange={setExportPassword}
                  sensitive
                  hint={`อย่างน้อย ${String(MIN_EXPORT_PASSWORD_LENGTH)} ตัวอักษร — ไม่ต้องเหมือนรหัสผ่านหลัก และถ้าลืมจะไม่มีใครเปิดไฟล์นี้ได้อีกเลย`}
                />
                <Callout tone="info">
                  กุญแจของไฟล์คำนวณจากรหัสผ่านนี้ด้วย Argon2id ชุดพารามิเตอร์เดียวกับ
                  รหัสผ่านหลัก การเดารหัสผ่านจึงแพงพอๆ กัน
                  <br />
                  ไฟล์ถูกสร้างในเครื่องคุณทั้งหมด เซิร์ฟเวอร์ไม่มีทางรู้ว่าคุณกดส่งออก
                </Callout>
              </>
            ) : (
              <Callout tone="danger">
                <strong>ไฟล์นี้ไม่ได้เข้ารหัส</strong> — รหัสผ่านทุกอันของคุณจะอยู่ในนั้น
                ในรูปที่อ่านได้ ใครก็ตามที่เปิดไฟล์นี้ได้จะเห็นทุกอย่าง
                <br />
                ไฟล์ถูกสร้างในเครื่องคุณทั้งหมด เซิร์ฟเวอร์ไม่มีทางรู้ว่าคุณกดส่งออก
              </Callout>
            )}

            {error !== null && <Callout tone="danger">{error}</Callout>}

            <div className="flex gap-2">
              <Button
                variant={encrypt ? "primary" : "danger"}
                disabled={busy || (encrypt && exportPassword.length < MIN_EXPORT_PASSWORD_LENGTH)}
                onClick={() => { void download(); }}
              >
                {busy ? "กำลังเข้ารหัส…" : encrypt ? "ดาวน์โหลดไฟล์ที่เข้ารหัสแล้ว" : "ฉันเข้าใจ — ดาวน์โหลด"}
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
                ยกเลิก
              </Button>
            </div>
            {done && (
              <Callout tone="info">
                {encrypt
                  ? "ดาวน์โหลดแล้ว — ลองตรวจสอบไฟล์ด้านล่างเพื่อยืนยันว่าเปิดได้จริง"
                  : "ดาวน์โหลดแล้ว — ลบไฟล์ทิ้งทันทีที่ใช้เสร็จ"}
              </Callout>
            )}
          </>
        )}
      </div>
    </Card>
  );
};

const RevokeSessionsCard = () => {
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
      setError(errorMessage(result.error));
      return;
    }

    setDone(true);
    setOpen(false);
  };

  return (
    <Card>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-900">ออกจากระบบทุกอุปกรณ์</h2>
        <p className="text-sm text-stone-600">
          ใช้เมื่อทำเครื่องหาย หรือสงสัยว่ามีคนอื่นเข้าถึงบัญชีอยู่ —
          บัตรผ่านทุกใบที่เคยออกไปจะใช้ไม่ได้ทันที <strong>ยกเว้นเครื่องนี้</strong>
        </p>

        {done && <Callout tone="success">เพิกถอนแล้ว — เครื่องอื่นทุกเครื่องต้องเข้าสู่ระบบใหม่</Callout>}

        {!open ? (
          <Button variant="ghost" onClick={() => { setOpen(true); setDone(false); }}>
            ออกจากระบบทุกอุปกรณ์
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
              hint="ต้องพิสูจน์ว่าเป็นเจ้าของตัวจริง — บัตรผ่านที่ค้างอยู่ในเครื่องอย่างเดียวไม่พอ"
            />

            {error !== null && <Callout tone="danger">{error}</Callout>}

            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? "กำลังเพิกถอน…" : "ยืนยัน"}
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
                ยกเลิก
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
};

const ImportCard = () => {
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (file: File): Promise<void> => {
    const vaultId = getDefaultVaultId();
    if (vaultId === null) {
      setError("ยังไม่มี vault ให้นำเข้า");
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
      setError("นำเข้าไม่ได้ — รหัสผ่านผิด หรือไฟล์ไม่ใช่ไฟล์ส่งออกของ Kunjae");
      return;
    }

    const { added, skipped, invalid, failed } = imported.value;
    setResult(
      `เพิ่ม ${String(added)} รายการ · ข้ามเพราะมีอยู่แล้ว ${String(skipped)} · ` +
        `อ่านไม่ออก ${String(invalid)} · บันทึกไม่สำเร็จ ${String(failed)}`,
    );
  };

  return (
    <Card>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-900">นำเข้าไฟล์ส่งออก</h2>
        <p className="text-sm text-stone-600">
          เอาข้อมูลจากไฟล์ที่เคยส่งออกกลับเข้าบัญชีนี้ —
          <strong> เพิ่มอย่างเดียว ไม่ลบและไม่ทับของเดิม</strong>
          {" "}รายการที่ซ้ำกับของที่มีอยู่แล้วจะถูกข้าม
        </p>

        <Field
          label="รหัสผ่านของไฟล์ (เว้นว่างถ้าไฟล์ไม่ได้เข้ารหัส)"
          type="password"
          value={password}
          onChange={setPassword}
          sensitive
        />

        <label className="block space-y-1 text-sm font-medium text-stone-700">
          <span>เลือกไฟล์ส่งออกที่จะนำเข้า</span>
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

        {busy && <Callout tone="info">กำลังนำเข้า… อาจใช้เวลาสักครู่ถ้าไฟล์ถูกเข้ารหัส</Callout>}
        {result !== null && <Callout tone="success">{result}</Callout>}
        {error !== null && <Callout tone="danger">{error}</Callout>}
      </div>
    </Card>
  );
};

const VerifyExportCard = () => {
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
      setError("เปิดไฟล์ไม่ได้ — รหัสผ่านผิด หรือไฟล์ไม่ใช่ไฟล์ส่งออกที่เข้ารหัสของ Kunjae");
      return;
    }

    try {
      const parsed = JSON.parse(opened.value) as { readonly items?: readonly unknown[] };
      setResult(`เปิดได้ — ในไฟล์มี ${String(parsed.items?.length ?? 0)} รายการ`);
    } catch {
      setError("เปิดได้แต่เนื้อหาข้างในไม่ใช่รูปแบบที่รู้จัก");
    }
  };

  return (
    <Card>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-900">ตรวจสอบไฟล์ส่งออก</h2>
        <p className="text-sm text-stone-600">
          ไฟล์สำรองที่ไม่เคยลองเปิด คือไฟล์สำรองที่ยังพิสูจน์ไม่ได้ว่าใช้ได้จริง —
          ตรวจตอนนี้ดีกว่าตอนที่ต้องพึ่งมัน
        </p>

        <Field
          label="รหัสผ่านของไฟล์"
          type="password"
          value={password}
          onChange={setPassword}
          sensitive
        />

        <label className="block space-y-1 text-sm font-medium text-stone-700">
          <span>เลือกไฟล์ส่งออกที่จะตรวจสอบ</span>
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

        {busy && <Callout tone="info">กำลังคำนวณกุญแจจากรหัสผ่าน…</Callout>}
        {result !== null && <Callout tone="success">{result}</Callout>}
        {error !== null && <Callout tone="danger">{error}</Callout>}
      </div>
    </Card>
  );
};

const CONFIRM_PHRASE = "ลบบัญชีของฉัน";

const DeleteAccountCard = () => {
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
      setError(errorMessage(result.error));
      setBusy(false);
      return;
    }

    setBusy(false);
  };

  return (
    <Card>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-red-700">ลบบัญชีถาวร</h2>
        <Callout tone="danger">
          ลบบัญชี vault และรายการทั้งหมดออกจากเซิร์ฟเวอร์ทันที
          <strong> ไม่มีสำเนาสำรองและกู้คืนไม่ได้ </strong>
          เพราะเราไม่เคยมีกุญแจของคุณอยู่แล้ว — แม้แต่เราเองก็กู้ให้ไม่ได้
        </Callout>

        {!open ? (
          <Button variant="ghost" onClick={() => { setOpen(true); }}>
            ฉันต้องการลบบัญชี
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
              hint="ต้องพิสูจน์ว่าเป็นเจ้าของตัวจริง — บัตรผ่านที่ค้างอยู่ในเครื่องอย่างเดียวไม่พอ"
            />
            <Field
              label={`พิมพ์ว่า "${CONFIRM_PHRASE}" เพื่อยืนยัน`}
              value={phrase}
              onChange={setPhrase}
            />

            {error !== null && <Callout tone="danger">{error}</Callout>}

            <div className="flex gap-2">
              <Button
                type="submit"
                variant="danger"
                disabled={busy || phrase !== CONFIRM_PHRASE}
              >
                {busy ? "กำลังลบ…" : "ลบบัญชีถาวร"}
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
                ยกเลิก
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
};

export const SettingsPage = () => (
  <RequireUnlocked>
    <SettingsScreen />
  </RequireUnlocked>
);
