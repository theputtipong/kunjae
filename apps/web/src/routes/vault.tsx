import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  emptyItemOfType,
  generatePassword,
  ITEM_TYPES,
  ITEM_TYPE_LABELS,
  type ItemContent,
  type ItemType,
} from "@kunjae/domain";

import { totpFromSecretText } from "@kunjae/core-crypto";

import { createUlid } from "@kunjae/client-core";
import { errorMessage } from "@kunjae/client-core";
import {
  createNewVault,
  deleteItemById,
  moveItemToVault,
  pull,
  saveItem,
} from "@kunjae/client-core";
import {
  getDefaultVaultId,
  getItemContent,
  getItemRef,
  getStoreView,
  subscribeToStore,
} from "@kunjae/client-core";
import { Button, Callout, Card, Field } from "../ui/primitives.tsx";
import { RequireUnlocked } from "./require-unlocked.tsx";

const CLIPBOARD_CLEAR_MS = 30_000;

const copySecret = (value: string): void => {
  void navigator.clipboard.writeText(value).then(() => {
    setTimeout(() => {
      void navigator.clipboard.writeText("");
    }, CLIPBOARD_CLEAR_MS);
  });
};

type EditorProps = {
  readonly itemId: string | null;
  readonly targetVaultId: string | null;
  readonly onDone: () => void;
};

const ItemEditor = ({ itemId, targetVaultId, onDone }: EditorProps) => {
  const nowIso = new Date().toISOString();

  const [content, setContent] = useState<ItemContent>(() => {
    const existing = itemId === null ? null : getItemContent(itemId);
    return existing ?? emptyItemOfType("login", "", nowIso);
  });

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = (): void => {
    const generated = generatePassword({
      length: 20,
      lowercase: true,
      uppercase: true,
      digits: true,
      symbols: true,
      excludeAmbiguous: false,
      requireEachSet: true,
    });

    if (!generated.ok) {
      setError("สร้างรหัสผ่านไม่สำเร็จ");
      return;
    }

    setContent((current) =>
      current.type === "login" ? { ...current, password: generated.value } : current,
    );
  };

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);

    const nowMs = Date.now();
    const ref = itemId === null ? null : getItemRef(itemId);

    const saveToVaultId = ref?.vaultId ?? targetVaultId ?? getDefaultVaultId();
    if (saveToVaultId === null) {
      setError("ยังไม่มี vault ให้บันทึก");
      setBusy(false);
      return;
    }

    const newId = createUlid(nowMs);
    if (ref === null && !newId.ok) {
      setError("สร้างรหัสรายการไม่สำเร็จ");
      setBusy(false);
      return;
    }

    const result = await saveItem({
      itemId: ref?.itemId ?? (newId.ok ? newId.value : ""),
      vaultId: saveToVaultId,
      content,
      baseVersion: ref?.version ?? 0,
      nowMs,
    });

    if (!result.ok) {
      setError(errorMessage(result.error));
      setBusy(false);
      return;
    }

    onDone();
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
        <h2 className="text-lg font-semibold text-stone-900">
          {itemId === null ? "รายการใหม่" : "แก้ไขรายการ"}
        </h2>

        {itemId === null && (
          <fieldset className="space-y-1">
            <legend className="block text-sm font-medium text-stone-700">ประเภท</legend>
            <div className="flex flex-wrap gap-2">
              {ITEM_TYPES.map((candidate) => (
                <Button
                  key={candidate}
                  variant={content.type === candidate ? "primary" : "ghost"}
                  onClick={() => {
                    setContent((c) => emptyItemOfType(candidate satisfies ItemType, c.title, nowIso));
                  }}
                >
                  {ITEM_TYPE_LABELS[candidate]}
                </Button>
              ))}
            </div>
          </fieldset>
        )}

        <Field
          label="ชื่อรายการ"
          value={content.title}
          onChange={(title) => { setContent((c) => ({ ...c, title })); }}
          autoFocus
        />

        {content.type === "login" && (
          <>
            <Field
              label="ชื่อผู้ใช้"
              value={content.username}
              onChange={(username) => {
                setContent((c) => (c.type === "login" ? { ...c, username } : c));
              }}
            />

            <Field
              label="รหัสผ่าน"
              type="password"
              value={content.password}
              onChange={(password) => {
                setContent((c) => (c.type === "login" ? { ...c, password } : c));
              }}
              sensitive
            />

            <Button variant="ghost" onClick={generate}>
              สร้างรหัสผ่านที่แข็งแรงให้
            </Button>

            <Field
              label="ความลับ TOTP (ตัวเลือก)"
              value={content.totpSecret}
              onChange={(totpSecret) => {
                setContent((c) => (c.type === "login" ? { ...c, totpSecret } : c));
              }}
              sensitive
              hint="วางค่า base32 ที่เว็บให้มา (เว้นวรรคได้) — ไม่ใช่รูปแบบเดียวกับ Secret Key ของ Kunjae"
            />

            <Field
              label="เว็บไซต์"
              value={content.urls[0] ?? ""}
              onChange={(url) => {
                setContent((c) => (c.type === "login" ? { ...c, urls: url === "" ? [] : [url] } : c));
              }}
              placeholder="https://example.com"
            />
          </>
        )}

        {content.type === "card" && (
          <>
            <Field
              label="ชื่อบนบัตร"
              value={content.cardholderName}
              onChange={(cardholderName) => {
                setContent((c) => (c.type === "card" ? { ...c, cardholderName } : c));
              }}
            />

            <Field
              label="เลขบัตร"
              value={content.number}
              onChange={(number) => {
                setContent((c) => (c.type === "card" ? { ...c, number } : c));
              }}
              sensitive
              hint="เก็บเป็นข้อความ ไม่ใช่ตัวเลข — เลข 16 หลักเกินช่วงที่ JavaScript เก็บได้แม่นยำ"
            />

            <div className="flex gap-2">
              <Field
                label="เดือนหมดอายุ"
                value={content.expiryMonth}
                onChange={(expiryMonth) => {
                  setContent((c) => (c.type === "card" ? { ...c, expiryMonth } : c));
                }}
                placeholder="01"
              />
              <Field
                label="ปีหมดอายุ"
                value={content.expiryYear}
                onChange={(expiryYear) => {
                  setContent((c) => (c.type === "card" ? { ...c, expiryYear } : c));
                }}
                placeholder="2030"
              />
            </div>

            <Field
              label="รหัสหลังบัตร"
              type="password"
              value={content.securityCode}
              onChange={(securityCode) => {
                setContent((c) => (c.type === "card" ? { ...c, securityCode } : c));
              }}
              sensitive
            />
          </>
        )}

        <Field
          label="โน้ต"
          value={content.notes}
          onChange={(notes) => { setContent((c) => ({ ...c, notes })); }}
          sensitive
        />

        {error !== null && <Callout tone="danger">{error}</Callout>}

        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? "กำลังเข้ารหัสและบันทึก…" : "บันทึก"}
          </Button>
          <Button variant="ghost" onClick={onDone}>
            ยกเลิก
          </Button>
        </div>
      </form>
    </Card>
  );
};

const TotpRow = ({ secret }: { readonly secret: string }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => { setNow(Date.now()); }, 1000);
    return () => { clearInterval(id); };
  }, []);

  const result = totpFromSecretText(secret, now);

  if (!result.ok) {
    return (
      <div>
        <p className="text-xs font-medium text-stone-500">รหัสผ่านครั้งเดียว</p>
        <p className="text-sm text-red-700">ความลับ TOTP อ่านไม่ได้ — ตรวจสอบค่าที่บันทึกไว้</p>
      </div>
    );
  }

  const { code, secondsRemaining } = result.value;

  return (
    <div>
      <p className="text-xs font-medium text-stone-500">รหัสผ่านครั้งเดียว</p>
      <div className="flex items-center gap-3">
        <p translate="no" className="font-mono text-lg tracking-widest text-stone-900">
          {`${code.slice(0, 3)} ${code.slice(3)}`}
        </p>
        <span className="text-xs text-stone-500">{secondsRemaining} วิ</span>
      </div>

      <div className="mt-1 h-1 w-32 overflow-hidden rounded bg-stone-200">
        <div
          className="h-full bg-brand-500 transition-[width] duration-1000 ease-linear"
          style={{ width: `${String((secondsRemaining / 30) * 100)}%` }}
        />
      </div>

      <div className="mt-2">
        <Button variant="ghost" onClick={() => { copySecret(code); }}>
          คัดลอกรหัส
        </Button>
      </div>
    </div>
  );
};

const ItemDetail = ({
  itemId,
  vaults,
  onEdit,
  onDeleted,
  onMoved,
}: {
  readonly itemId: string;
  readonly vaults: readonly { readonly vaultId: string; readonly name: string }[];
  readonly onEdit: () => void;
  readonly onDeleted: () => void;
  readonly onMoved: () => void;
}) => {
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const content = getItemContent(itemId);
  if (content === null) return null;

  const remove = async (): Promise<void> => {
    const ref = getItemRef(itemId);
    if (ref === null) return;

    const result = await deleteItemById(ref, Date.now());
    if (!result.ok) {
      setError(errorMessage(result.error));
      return;
    }

    onDeleted();
  };

  return (
    <Card>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-stone-900">{content.title}</h2>

        {content.type === "login" && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-stone-500">ชื่อผู้ใช้</p>
              <p className="text-sm text-stone-900">{content.username || "—"}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-stone-500">รหัสผ่าน</p>
              <p translate="no" className="font-mono text-sm break-all text-stone-900">
                {revealed ? content.password : "••••••••••••"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => { setRevealed(!revealed); }}>
                  {revealed ? "ซ่อน" : "แสดง"}
                </Button>
                <Button variant="ghost" onClick={() => { copySecret(content.password); }}>
                  คัดลอก (ล้างอัตโนมัติใน 30 วินาที)
                </Button>
              </div>
            </div>

            {content.totpSecret !== "" && <TotpRow secret={content.totpSecret} />}

            {content.urls.length > 0 && (
              <div>
                <p className="text-xs font-medium text-stone-500">เว็บไซต์</p>
                <p className="text-sm break-all text-stone-900">{content.urls[0]}</p>
              </div>
            )}
          </div>
        )}

        {content.type === "card" && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-stone-500">ชื่อบนบัตร</p>
              <p className="text-sm text-stone-900">{content.cardholderName || "—"}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-stone-500">เลขบัตร</p>
              <p translate="no" className="font-mono text-sm break-all text-stone-900">
                {revealed ? content.number || "—" : "•••• •••• •••• ••••"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => { setRevealed(!revealed); }}>
                  {revealed ? "ซ่อน" : "แสดง"}
                </Button>
                <Button variant="ghost" onClick={() => { copySecret(content.number); }}>
                  คัดลอก (ล้างอัตโนมัติใน 30 วินาที)
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-stone-500">หมดอายุ</p>
              <p className="text-sm text-stone-900">
                {content.expiryMonth === "" && content.expiryYear === ""
                  ? "—"
                  : `${content.expiryMonth || "??"}/${content.expiryYear || "????"}`}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-stone-500">รหัสหลังบัตร</p>
              <p translate="no" className="font-mono text-sm text-stone-900">
                {revealed ? content.securityCode || "—" : "•••"}
              </p>
            </div>
          </div>
        )}

        {content.notes !== "" && (
          <div>
            <p className="text-xs font-medium text-stone-500">โน้ต</p>
            <p className="text-sm whitespace-pre-wrap text-stone-900">{content.notes}</p>
          </div>
        )}

        {error !== null && <Callout tone="danger">{error}</Callout>}

        {vaults.length > 1 && (
          <div>
            <p className="text-xs font-medium text-stone-500">ย้ายไปยัง vault</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {vaults
                .filter((vault) => vault.vaultId !== getItemRef(itemId)?.vaultId)
                .map((vault) => (
                  <Button
                    key={vault.vaultId}
                    variant="ghost"
                    disabled={moving}
                    onClick={() => {
                      void (async () => {
                        setMoving(true);
                        setError(null);

                        const result = await moveItemToVault({
                          itemId,
                          targetVaultId: vault.vaultId,
                          nowMs: Date.now(),
                        });

                        setMoving(false);
                        if (!result.ok) {
                          setError(errorMessage(result.error));
                          return;
                        }

                        onMoved();
                      })();
                    }}
                  >
                    {moving ? "กำลังย้าย…" : vault.name}
                  </Button>
                ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="ghost" onClick={onEdit}>
            แก้ไข
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              void remove();
            }}
          >
            ลบ
          </Button>
        </div>
      </div>
    </Card>
  );
};

const TYPE_ICON: Record<ItemType, string> = {
  login: "🔑",
  "secure-note": "📄",
  card: "💳",
};

const AVATAR_COLORS = ["#8a6500", "#386a20", "#006a6a", "#8b5000", "#984061", "#00639b", "#6c5e00", "#5b5f97"];

const LetterAvatar = ({ title }: { readonly title: string }) => {
  let hash = 0;
  for (const char of title.toLowerCase()) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) | 0;
  const color = AVATAR_COLORS[((hash % AVATAR_COLORS.length) + AVATAR_COLORS.length) % AVATAR_COLORS.length];
  const first = new Intl.Segmenter("th", { granularity: "grapheme" }).segment(title.trim())[Symbol.iterator]().next();
  const letter = first.done === true ? "?" : first.value.segment.toUpperCase();

  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: color }}
      className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
    >
      {letter}
    </span>
  );
};

const Chip = ({
  selected,
  onClick,
  children,
}: {
  readonly selected: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
}) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onClick}
    className={`rounded-full border px-4 py-1.5 text-sm transition ${
      selected ? "border-brand-300 bg-brand-100 font-medium text-brand-900" : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
    }`}
  >
    {children}
  </button>
);

const VaultScreen = () => {
  const view = useSyncExternalStore(subscribeToStore, getStoreView, getStoreView);

  const pulledOnce = useRef(false);

  useEffect(() => {
    if (pulledOnce.current || view.vaults.length > 0) return;

    pulledOnce.current = true;
    void pull(Date.now());
  }, [view.vaults.length]);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ readonly itemId: string | null } | null>(null);

  const [activeVaultId, setActiveVaultId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<ItemType | null>(null);
  const [newVaultName, setNewVaultName] = useState("");
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [creatingVault, setCreatingVault] = useState(false);

  const addVault = async (): Promise<void> => {
    const name = newVaultName.trim();
    if (name === "") return;

    setCreatingVault(true);
    setVaultError(null);

    const result = await createNewVault({ name, nowMs: Date.now() });

    setCreatingVault(false);
    if (!result.ok) {
      setVaultError(errorMessage(result.error));
      return;
    }

    setNewVaultName("");
    setActiveVaultId(result.value);
  };

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return view.items.filter((item) => {
      if (activeVaultId !== null && item.vaultId !== activeVaultId) return false;
      if (typeFilter !== null && item.type !== typeFilter) return false;
      if (needle === "") return true;

      return (
        item.title.toLowerCase().includes(needle) ||
        item.subtitle.toLowerCase().includes(needle)
      );
    });
  }, [query, view.items, activeVaultId, typeFilter]);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative grow">
          <span className="sr-only">ค้นหา</span>
          <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-stone-500">
            🔍
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); }}
            placeholder="ค้นหาในคลังข้อมูล"
            className="w-full rounded-full border border-stone-300 bg-white py-3 pr-4 pl-11 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-400/40"
          />
        </label>
        <Button
          variant="ghost"
          onClick={() => {
            void pull(Date.now());
          }}
          disabled={view.syncing}
        >
          {view.syncing ? "กำลังซิงค์…" : "🔄 ซิงค์"}
        </Button>
        <Button
          onClick={() => {
            setSelected(null);
            setEditing({ itemId: null });
          }}
        >
          ＋ เพิ่มรายการ
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip selected={typeFilter === null} onClick={() => { setTypeFilter(null); }}>
          ทั้งหมด
        </Chip>
        {ITEM_TYPES.map((type) => (
          <Chip
            key={type}
            selected={typeFilter === type}
            onClick={() => { setTypeFilter(typeFilter === type ? null : type); }}
          >
            {TYPE_ICON[type]} {ITEM_TYPE_LABELS[type]}
          </Chip>
        ))}

        {view.vaults.length > 1 && (
          <select
            aria-label="เลือก vault"
            value={activeVaultId ?? ""}
            onChange={(event) => { setActiveVaultId(event.target.value === "" ? null : event.target.value); }}
            className={`rounded-full border px-4 py-1.5 text-sm outline-none ${
              activeVaultId === null ? "border-stone-300 bg-white text-stone-700" : "border-brand-300 bg-brand-100 text-brand-900"
            }`}
          >
            <option value="">📁 ทุก vault ({view.items.length})</option>
            {view.vaults.map((vault) => (
              <option key={vault.vaultId} value={vault.vaultId}>
                📁 {vault.name} ({vault.itemCount})
              </option>
            ))}
          </select>
        )}
      </div>

      {view.brokenItemIds.length > 0 && (
        <Callout tone="warning">
          มี {view.brokenItemIds.length} รายการที่ถอดรหัสไม่ได้ —
          อาจถูกสร้างจากโปรแกรมรุ่นอื่น หรือข้อมูลถูกแก้ไขระหว่างทาง
          เราแสดงให้เห็นแทนที่จะซ่อนไว้ เพราะรายการที่หายไปเงียบๆ อันตรายกว่า
        </Callout>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          {results.length === 0 && (
            <Callout tone="info">
              {view.items.length === 0 ? "ยังไม่มีรายการใน vault นี้" : "ไม่พบรายการที่ตรงกับคำค้น"}
            </Callout>
          )}

          {results.length > 0 && (
            <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
              {results.map((item) => (
                <button
                  key={item.itemId}
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setSelected(item.itemId);
                  }}
                  className={`flex w-full items-center gap-4 border-b border-stone-100 px-4 py-3 text-left transition last:border-b-0 ${
                    selected === item.itemId ? "bg-brand-50" : "hover:bg-stone-50"
                  }`}
                >
                  <LetterAvatar title={item.title} />
                  <span className="min-w-0 grow">
                    <span className="block truncate text-sm font-medium text-stone-900">
                      {item.favorite && "★ "}
                      {item.title || "(ไม่มีชื่อ)"}
                    </span>
                    <span className="block truncate text-xs text-stone-500">
                      {TYPE_ICON[item.type]} {item.subtitle !== "" ? item.subtitle : ITEM_TYPE_LABELS[item.type]}
                    </span>
                  </span>
                  {item.hasTotp && (
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">2FA</span>
                  )}
                  <span aria-hidden="true" className="text-stone-400">›</span>
                </button>
              ))}
            </div>
          )}

          <details className="rounded-3xl border border-stone-200 bg-white px-5 py-3">
            <summary className="cursor-pointer text-sm font-medium text-brand-700">📁 สร้าง vault ใหม่</summary>
            <div className="mt-3 space-y-3">
              <Field
                label="ชื่อ vault"
                value={newVaultName}
                onChange={setNewVaultName}
                placeholder="เช่น งาน หรือ ครอบครัว"
                hint="ชื่อ vault ถูกเข้ารหัสด้วยกุญแจของมันเอง — เซิร์ฟเวอร์อ่านไม่ได้"
              />
              <Button onClick={() => { void addVault(); }} disabled={creatingVault || newVaultName.trim() === ""}>
                {creatingVault ? "กำลังสร้าง…" : "สร้าง"}
              </Button>
              {vaultError !== null && <Callout tone="danger">{vaultError}</Callout>}
            </div>
          </details>
        </div>

        <div>
          {editing !== null && (
            <ItemEditor
              itemId={editing.itemId}
              targetVaultId={activeVaultId}
              onDone={() => {
                setEditing(null);
              }}
            />
          )}

          {editing === null && selected !== null && (
            <ItemDetail
              key={selected}
              itemId={selected}
              vaults={view.vaults}
              onMoved={() => {
                setSelected(null);
              }}
              onEdit={() => {
                setEditing({ itemId: selected });
              }}
              onDeleted={() => {
                setSelected(null);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export const VaultPage = () => (
  <RequireUnlocked>
    <VaultScreen />
  </RequireUnlocked>
);
