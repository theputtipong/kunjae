import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  ARGON2_PARAMS_V1,
  KEY_PURPOSE,
  bytesToBase32,
  bytesToBase64Url,
  bytesToHex,
  deriveKey256,
  deriveKeyFromPassword,
  deriveMasterUnlockKey,
  deriveAccountKeys,
  formatSecretKey,
  hexToBytes,
  importAeadKey,
  openFromEnvelope,
  parseSecretKey,
  toAccountSalt,
  toSecretKey,
  utf8ToBytes,
  type Bytes,
} from "@kunjae/core-crypto";
import { buildItemAad, buildVaultMetaAad } from "@kunjae/contracts";

const hex = (value: string): Bytes => {
  const decoded = hexToBytes(value);
  if (!decoded.ok) throw new Error(`hex ไม่ถูกต้อง: ${value}`);
  return decoded.value;
};

const utf8 = (value: string): Bytes => {
  const encoded = utf8ToBytes(value);
  if (!encoded.ok) throw new Error(`utf8 ไม่ถูกต้อง: ${value}`);
  return encoded.value;
};

const unwrap = <T>(result: { ok: boolean; value?: T; error?: unknown }, label: string): T => {
  if (!result.ok || result.value === undefined) {
    throw new Error(`${label} ล้มเหลว: ${JSON.stringify(result.error)}`);
  }
  return result.value;
};

const VECTORS_DIR = join(import.meta.dirname, "..", "vectors");

const writeVectors = (name: string, payload: unknown): void => {
  const file = join(VECTORS_DIR, `${name}.json`);
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`  ✔ ${name}.json`);
};

const generateEncoding = (): void => {
  const samples = [
    { label: "ว่างเปล่า", bytesHex: "" },
    { label: "หนึ่งไบต์", bytesHex: "00" },
    { label: "ค่าสูงสุดหนึ่งไบต์", bytesHex: "ff" },
    { label: "ลำดับ 0-7", bytesHex: "0001020304050607" },
    { label: "กุญแจ 16 ไบต์", bytesHex: "8f2a1c7b93e4d05a6f18c2b47d903e51" },
    { label: "กุญแจ 32 ไบต์", bytesHex: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f" },
    { label: "nonce 12 ไบต์", bytesHex: "cafebabefacedbaddecaf888" },
  ];

  writeVectors("encoding", {
    description: "แปลงระหว่างไบต์กับข้อความสามรูปแบบ ผลลัพธ์ต้องตรงกันทุกอักขระ",
    note: "base32 ใช้ชุดอักขระ Crockford (ไม่มี I L O U) และ base64url ไม่มี padding",
    encode: samples.map((sample) => {
      const bytes = hex(sample.bytesHex);
      return {
        label: sample.label,
        bytesHex: sample.bytesHex,
        hex: bytesToHex(bytes),
        base32: bytesToBase32(bytes),
        base64url: bytesToBase64Url(bytes),
      };
    }),
    utf8: [
      { label: "ASCII", text: "hello", bytesHex: bytesToHex(utf8("hello")) },
      { label: "ภาษาไทย", text: "รหัสผ่าน", bytesHex: bytesToHex(utf8("รหัสผ่าน")) },
      { label: "อีโมจิ", text: "🔐", bytesHex: bytesToHex(utf8("🔐")) },
    ],
    mustReject: {
      hex: ["abc", "zz", "0g"],
      base32: ["UUUU", "A", "ABC", "ABCDEF", "01", "AB-CD"],
      base64url: ["QQ==", "a+b/", "A", "QR"],
    },
  });
};

const generateKdf = async (): Promise<void> => {
  const ikm = hex("0b".repeat(32));
  const salt = hex("22".repeat(32));

  const hkdf = Object.values(KEY_PURPOSE).map((purpose) => ({
    purpose,
    ikmHex: bytesToHex(ikm),
    saltHex: bytesToHex(salt),
    lengthBytes: 32,
    okmHex: bytesToHex(unwrap(deriveKey256(ikm, salt, purpose), `hkdf ${purpose}`)),
  }));

  const argonPassword = utf8("correct horse battery staple");
  const argonSalt = hex("02".repeat(16));
  const argonOut = unwrap(
    await deriveKeyFromPassword(argonPassword, argonSalt, ARGON2_PARAMS_V1),
    "argon2id",
  );

  writeVectors("kdf", {
    description: "HKDF-SHA256 และ Argon2id ต้องให้ผลลัพธ์ตรงกันทุกไบต์",
    hkdf: {
      hash: "SHA-256",
      note: "info คือข้อความ UTF-8 ของ purpose ส่วน salt กับ ikm เป็นไบต์ดิบ",
      cases: hkdf,
    },
    argon2id: {
      note: "รหัสผ่านถูกแปลงเป็นไบต์ด้วย UTF-8 ก่อนส่งเข้า KDF",
      params: ARGON2_PARAMS_V1,
      passwordUtf8: "correct horse battery staple",
      saltHex: bytesToHex(argonSalt),
      outputHex: bytesToHex(argonOut),
    },
  });
};

const generateKeyHierarchy = async (): Promise<void> => {
  const masterPassword = "MyStr0ng!Pass รหัสไทย";
  const secretKey = unwrap(toSecretKey(hex("8f2a1c7b93e4d05a6f18c2b47d903e51")), "secretKey");
  const accountSalt = unwrap(
    toAccountSalt(hex("3f".repeat(32))),
    "accountSalt",
  );

  const muk = unwrap(
    await deriveMasterUnlockKey({
      masterPassword: utf8(masterPassword),
      secretKey,
      accountSalt,
      argon2: ARGON2_PARAMS_V1,
    }),
    "muk",
  );

  const accountKeys = unwrap(deriveAccountKeys(muk, accountSalt), "accountKeys");

  writeVectors("key-hierarchy", {
    description:
      "การคำนวณกุญแจทั้งสายจาก Master Password กับ Secret Key จนถึง Auth Key และ Wrapping Key",
    procedure: [
      "kPassword = Argon2id(utf8(masterPassword), accountSalt, params)",
      `kSecret   = HKDF-SHA256(ikm=secretKey, salt=accountSalt, info="${KEY_PURPOSE.SECRET_KEY_STRETCH}", len=32)`,
      `MUK       = HKDF-SHA256(ikm=kPassword||kSecret, salt=accountSalt, info="${KEY_PURPOSE.MASTER_UNLOCK_KEY}", len=32)`,
      `authKey   = HKDF-SHA256(ikm=MUK, salt=accountSalt, info="${KEY_PURPOSE.AUTHENTICATION}", len=32)`,
      `wrapKey   = HKDF-SHA256(ikm=MUK, salt=accountSalt, info="${KEY_PURPOSE.VAULT_KEY_WRAPPING}", len=32)`,
    ],
    input: {
      masterPassword,
      secretKeyHex: bytesToHex(secretKey),
      accountSaltHex: bytesToHex(accountSalt),
      argon2: ARGON2_PARAMS_V1,
    },
    expected: {
      mukHex: bytesToHex(muk),
      authKeyHex: bytesToHex(accountKeys.authKey),
      wrappingKeyHex: bytesToHex(accountKeys.wrappingKey),
      authKeyBase64Url: bytesToBase64Url(accountKeys.authKey),
    },
  });
};

const generateSecretKeyFormat = (): void => {
  const samples = [
    "8f2a1c7b93e4d05a6f18c2b47d903e51",
    "00000000000000000000000000000000",
    "ffffffffffffffffffffffffffffffff",
  ];

  const formatted = samples.map((bytesHex) => {
    const key = unwrap(toSecretKey(hex(bytesHex)), "toSecretKey");
    const text = formatSecretKey(key);
    const parsed = unwrap(parseSecretKey(text), "parseSecretKey");
    if (bytesToHex(parsed) !== bytesHex) throw new Error("อ่านกลับแล้วไม่ตรงกับต้นฉบับ");
    return { bytesHex, formatted: text };
  });

  const canonical = formatted[0];
  if (canonical === undefined) throw new Error("ไม่มีตัวอย่าง");

  writeVectors("secret-key", {
    description: "การจัดรูปแบบและการอ่าน Secret Key ในรูปที่มนุษย์พิมพ์ได้",
    format: "K1-UUUUUU-UUUUU-UUUUU-UUUUU-UUUUU โดย U คือตัวแทนตำแหน่งของอักขระ Crockford Base32",
    formatted,
    parseLenient: {
      note: "ทั้งหมดนี้ต้องอ่านได้เป็นค่าเดียวกับ expectedHex",
      expectedHex: canonical.bytesHex,
      inputs: [
        canonical.formatted,
        canonical.formatted.toLowerCase(),
        canonical.formatted.replace(/-/gu, ""),
        canonical.formatted.replace(/-/gu, " "),
        `  ${canonical.formatted}  `,
      ],
    },
    mustReject: [
      canonical.formatted.slice(3),
      `K2${canonical.formatted.slice(2)}`,
      canonical.formatted.slice(0, -1),
      `${canonical.formatted}A`,
      "K1-UUUUUU-UUUUU-UUUUU-UUUUU-UUUUU",
    ],
  });
};

const FIXED_AEAD = {
  keyHex: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  itemId: "01J8ZQK9P0Z8YXWVTSRQNMKJHG",
  version: 1,
  plaintext: '{"hello":"โลก"}',
  envelope: {
    v: 1 as const,
    alg: "A256GCM" as const,
    n: "EQh2kifwivvcY3NI",
    ct: "NCcAitaCEot58mx01wF-mPR3V5fWHvbp3LvC2pzZNj07_Yzovw",
  },
};

const generateAead = async (): Promise<void> => {
  const key = unwrap(await importAeadKey(hex(FIXED_AEAD.keyHex)), "importAeadKey");
  const aad = buildItemAad(FIXED_AEAD.itemId, FIXED_AEAD.version);

  const opened = await openFromEnvelope(key, FIXED_AEAD.envelope, utf8(aad));
  if (!opened.ok) throw new Error("ค่าคงที่ของ AEAD ถอดรหัสไม่ได้แล้ว");

  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(opened.value);
  if (decoded !== FIXED_AEAD.plaintext) {
    throw new Error(`ถอดรหัสแล้วได้ข้อความไม่ตรง: ${decoded}`);
  }

  writeVectors("aead", {
    description: "AES-256-GCM ผ่านรูปแบบ Envelope พร้อมการผูก header เข้ากับ AAD",
    algorithm: {
      name: "AES-256-GCM",
      keyBytes: 32,
      nonceBytes: 12,
      tagBytes: 16,
      note: "ciphertext รวม authentication tag ไว้ท้ายสุดแล้ว",
    },
    aadConstruction: {
      note: "AAD ที่ส่งเข้า AEAD จริงคือ header ของ envelope ต่อด้วย AAD ของผู้เรียก",
      headerTemplate: "kunjae.env.{v}.{alg}|",
      example: {
        envelopeHeader: "kunjae.env.1.A256GCM|",
        callerAad: aad,
        combined: `kunjae.env.1.A256GCM|${aad}`,
        combinedHex: bytesToHex(utf8(`kunjae.env.1.A256GCM|${aad}`)),
      },
    },
    decrypt: {
      keyHex: FIXED_AEAD.keyHex,
      itemId: FIXED_AEAD.itemId,
      version: FIXED_AEAD.version,
      envelope: FIXED_AEAD.envelope,
      expectedPlaintext: FIXED_AEAD.plaintext,
      expectedPlaintextHex: bytesToHex(utf8(FIXED_AEAD.plaintext)),
    },
    mustFail: [
      { reason: "version ไม่ตรง (rollback)", itemId: FIXED_AEAD.itemId, version: 2 },
      { reason: "itemId ไม่ตรง (swap)", itemId: "01J8ZQK9P0Z8YXWVTSRQNMKJHH", version: 1 },
      { reason: "alg ถูกแก้", envelopeAlg: "A128GCM" },
      { reason: "v ถูกแก้", envelopeVersion: 2 },
    ],
  });
};

const generateProtocol = (): void => {
  const itemId = "01J8ZQK9P0Z8YXWVTSRQNMKJHG";
  const vaultId = "5X5YZEPTWYXCCKFJQB0Q0H8338";

  writeVectors("protocol", {
    description: "ข้อความ AAD และรูปแบบข้อมูลที่ทุกแพลตฟอร์มต้องสร้างได้เหมือนกัน",
    itemAad: [1, 2, 42].map((version) => ({
      itemId,
      version,
      aad: buildItemAad(itemId, version),
      aadHex: bytesToHex(utf8(buildItemAad(itemId, version))),
    })),
    vaultMetaAad: [1, 7].map((version) => ({
      vaultId,
      version,
      aad: buildVaultMetaAad(vaultId, version),
      aadHex: bytesToHex(utf8(buildVaultMetaAad(vaultId, version))),
    })),
    itemContentExample: {
      note: "ชื่อฟิลด์ต้องตรงกันทุกตัวอักษร ฝั่ง Kotlin ต้อง serialize ได้เหมือนกัน",
      value: {
        type: "login",
        title: "ธนาคารกรุงเทพ",
        notes: "",
        tags: ["การเงิน"],
        favorite: false,
        customFields: [],
        createdAt: "2026-09-20T10:00:00+07:00",
        updatedAt: "2026-09-20T10:00:00+07:00",
        username: "pdouvch",
        password: "S3cr3t!Pass",
        urls: ["bualuang.co.th"],
        totpSecret: "",
      },
    },
  });
};

const generateTotp = (): void => {
  const seeds = {
    SHA1: "12345678901234567890",
    SHA256: "12345678901234567890123456789012",
    SHA512: "1234567890123456789012345678901234567890123456789012345678901234",
  } as const;

  const rfc6238: readonly (readonly [number, string, string, string])[] = [
    [59, "94287082", "46119246", "90693936"],
    [1111111109, "07081804", "68084774", "25091201"],
    [1111111111, "14050471", "67062674", "99943326"],
    [1234567890, "89005924", "91819424", "93441116"],
    [2000000000, "69279037", "90698825", "38618901"],
    [20000000000, "65353130", "77737706", "47863826"],
  ];

  const rfc4226 = [
    "755224", "287082", "359152", "969429", "338314",
    "254676", "287922", "162583", "399871", "520489",
  ];

  writeVectors("totp", {
    description: "รหัสผ่านครั้งเดียว — ค่าที่คาดหวังมาจากตัวมาตรฐานโดยตรง ไม่ได้มาจากโค้ดของเรา",
    note:
      "ความลับของ TOTP ใช้ base32 ของ RFC 4648 (A-Z, 2-7) " +
      "ซึ่งเป็นคนละชุดกับ Crockford ที่ Secret Key ของ Kunjae ใช้",

    seeds: Object.entries(seeds).map(([algorithm, ascii]) => ({
      algorithm,
      ascii,
      hex: bytesToHex(utf8(ascii)),
    })),

    rfc6238: rfc6238.flatMap(([unixSeconds, sha1, sha256, sha512]) =>
      (
        [
          ["SHA1", sha1],
          ["SHA256", sha256],
          ["SHA512", sha512],
        ] as const
      ).map(([algorithm, code]) => ({
        unixSeconds,
        algorithm,
        digits: 8,
        periodSeconds: 30,
        seedHex: bytesToHex(utf8(seeds[algorithm])),
        code,
      })),
    ),

    rfc4226: rfc4226.map((code, counter) => ({
      counter,
      algorithm: "SHA1",
      digits: 6,
      seedHex: bytesToHex(utf8(seeds.SHA1)),
      code,
    })),

    decode: [
      { label: "ความลับมาตรฐาน", text: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", bytesHex: bytesToHex(utf8(seeds.SHA1)) },
      { label: "ตัวพิมพ์เล็ก", text: "gezdgnbvgy3tqojq", bytesHex: bytesToHex(utf8("1234567890")) },
      { label: "มีช่องว่างและขีดกลาง", text: "GEZD GNBV-GY3T QOJQ", bytesHex: bytesToHex(utf8("1234567890")) },
      { label: "มี padding ท้าย", text: "MZXW6===", bytesHex: bytesToHex(utf8("foo")) },
      { label: "บิตที่เหลือเป็นศูนย์", text: "MZXQ", bytesHex: bytesToHex(utf8("fo")) },
    ],

    rejectDecode: [
      { label: "มี 0 ซึ่งไม่อยู่ใน RFC 4648 (แต่อยู่ใน Crockford)", text: "GEZD0NBV" },
      { label: "มี 1 ซึ่งไม่อยู่ใน RFC 4648", text: "GEZD1NBV" },
      { label: "มี 8 ซึ่งไม่อยู่ใน RFC 4648", text: "GEZD8NBV" },
      { label: "อักขระแปลกปลอม", text: "GEZD!NBV" },
      { label: "ว่างเปล่า", text: "" },
      { label: "บิตที่เหลือไม่เป็นศูนย์ (พิมพ์ตัวสุดท้ายผิด)", text: "MZXR" },
    ],
  });
};

console.log("สร้างชุดข้อมูลทดสอบสำหรับ implementation ข้ามภาษา");
generateEncoding();
await generateKdf();
await generateKeyHierarchy();
generateSecretKeyFormat();
await generateAead();
generateProtocol();
generateTotp();
console.log("เสร็จสิ้น — ไฟล์ทั้งหมดอยู่ใน packages/crypto-spec/vectors/");
