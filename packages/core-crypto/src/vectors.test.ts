/// <reference types="node" />
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  ARGON2_PARAMS_V1,
  KEY_PURPOSE,
  LOCAL_KEY_PURPOSE,
  base32ToBytes,
  base64UrlToBytes,
  bytesToBase32,
  bytesToBase64Url,
  bytesToHex,
  bytesToUtf8,
  decodeTotpSecret,
  deriveAccountKeys,
  deriveKey,
  deriveKey256,
  deriveKeyFromPassword,
  deriveMasterUnlockKey,
  encodeAuthKey,
  formatSecretKey,
  hexToBytes,
  hotp,
  importAeadKey,
  openFromEnvelope,
  parseSecretKey,
  sealToEnvelope,
  toAccountSalt,
  toSecretKey,
  toWrappedVaultKey,
  totp,
  unwrapVaultKey,
  utf8ToBytes,
  validateArgon2Params,
  wrapVaultKey,
  type Argon2Params,
  type Bytes,
  type Envelope,
  type KeyPurpose,
  type TotpAlgorithm,
  type WrappingKey,
} from "./index.ts";

const VECTORS_DIR = join(import.meta.dirname, "..", "..", "crypto-spec", "vectors");

const load = (name: string): unknown =>
  JSON.parse(readFileSync(join(VECTORS_DIR, `${name}.json`), "utf8"));

const hex = (value: string): Bytes => {
  const decoded = hexToBytes(value);
  assert.ok(decoded.ok, `hex: ${value}`);
  return decoded.value;
};

const utf8 = (value: string): Bytes => {
  const encoded = utf8ToBytes(value);
  assert.ok(encoded.ok);
  return encoded.value;
};

const itemAad = (itemId: string, version: number): string => `kunjae.v1.item|${itemId}|${String(version)}`;

type EncodingVectors = {
  encode: { label: string; bytesHex: string; hex: string; base32: string; base64url: string }[];
  utf8: { label: string; text: string; bytesHex: string }[];
  mustReject: { hex: string[]; base32: string[]; base64url: string[] };
};

type KdfVectors = {
  hkdf: {
    cases: { purpose: KeyPurpose; ikmHex: string; saltHex: string; lengthBytes: number; okmHex: string }[];
    mustReject: { label: string; purpose: KeyPurpose; ikmHex: string; saltHex: string; lengthBytes: number }[];
  };
  argon2id: { params: Argon2Params; passwordUtf8: string; saltHex: string; outputHex: string };
};

type KeyHierarchyVectors = {
  input: { masterPassword: string; secretKeyHex: string; accountSaltHex: string; argon2: Argon2Params };
  expected: { mukHex: string; authKeyHex: string; wrappingKeyHex: string; authKeyBase64Url: string };
};

type SecretKeyVectors = {
  formatted: { bytesHex: string; formatted: string }[];
  parseLenient: { expectedHex: string; inputs: string[] };
  mustReject: string[];
};

type AeadVectors = {
  aadConstruction: { example: { combined: string; combinedHex: string } };
  decrypt: {
    keyHex: string;
    itemId: string;
    version: number;
    envelope: Envelope;
    expectedPlaintext: string;
    expectedPlaintextHex: string;
  };
  mustFail: {
    reason: string;
    itemId?: string;
    version?: number;
    envelopeAlg?: string;
    envelopeVersion?: number;
  }[];
};

type ProtocolVectors = {
  itemAad: { itemId: string; version: number; aad: string; aadHex: string }[];
  vaultMetaAad: { vaultId: string; version: number; aad: string; aadHex: string }[];
  vaultKeyAad: { vaultId: string; aad: string; aadHex: string }[];
};

type VaultKeyVectors = {
  unwrap: {
    wrappingKeyHex: string;
    vaultId: string;
    wrapped: Envelope;
    expectedVaultKeyHex: string;
  };
  mustFail: {
    reason: string;
    vaultId?: string;
    wrappingKeyHex?: string;
    envelopeAlg?: string;
    envelopeVersion?: number;
  }[];
};

type TotpVectors = {
  rfc6238: { unixSeconds: number; algorithm: TotpAlgorithm; digits: number; periodSeconds: number; seedHex: string; code: string }[];
  rfc4226: { counter: number; digits: number; seedHex: string; code: string }[];
  decode: { label: string; text: string; bytesHex: string }[];
  rejectDecode: { label: string; text: string }[];
};

const withEnvelope = (base: Envelope, alg?: string, v?: number): Envelope =>
  ({ ...base, alg: alg ?? base.alg, v: v ?? base.v }) as Envelope;

void describe("encoding.json", () => {
  const vector = load("encoding") as EncodingVectors;

  for (const c of vector.encode) {
    void test(`encode/decode: ${c.label}`, () => {
      const bytes = hex(c.bytesHex);
      assert.equal(bytesToHex(bytes), c.hex);
      assert.equal(bytesToBase32(bytes), c.base32);
      assert.equal(bytesToBase64Url(bytes), c.base64url);

      const fromBase32 = base32ToBytes(c.base32);
      assert.ok(fromBase32.ok);
      assert.equal(bytesToHex(fromBase32.value), c.bytesHex);

      const fromBase64 = base64UrlToBytes(c.base64url);
      assert.ok(fromBase64.ok);
      assert.equal(bytesToHex(fromBase64.value), c.bytesHex);
    });
  }

  for (const c of vector.utf8) {
    void test(`utf8: ${c.label}`, () => {
      assert.equal(bytesToHex(utf8(c.text)), c.bytesHex);
      const decoded = bytesToUtf8(hex(c.bytesHex));
      assert.ok(decoded.ok);
      assert.equal(decoded.value, c.text);
    });
  }

  const decoders = { hex: hexToBytes, base32: base32ToBytes, base64url: base64UrlToBytes } as const;

  for (const kind of ["hex", "base32", "base64url"] as const) {
    for (const bad of vector.mustReject[kind]) {
      void test(`mustReject ${kind}: "${bad}"`, () => {
        assert.equal(decoders[kind](bad).ok, false);
      });
    }
  }
});

void describe("kdf.json", () => {
  const vector = load("kdf") as KdfVectors;

  void test("hkdf cases cover every purpose incl local wrap", () => {
    const purposes = new Set(vector.hkdf.cases.map((c) => c.purpose));
    for (const purpose of [...Object.values(KEY_PURPOSE), ...Object.values(LOCAL_KEY_PURPOSE)]) {
      assert.ok(purposes.has(purpose), purpose);
    }
  });

  for (const c of vector.hkdf.cases) {
    void test(`hkdf: ${c.purpose}`, () => {
      const out = deriveKey({ ikm: hex(c.ikmHex), salt: hex(c.saltHex), purpose: c.purpose, length: c.lengthBytes });
      assert.ok(out.ok);
      assert.equal(bytesToHex(out.value), c.okmHex);
    });
  }

  void test("hkdf mustReject present", () => {
    assert.ok(vector.hkdf.mustReject.length > 0);
  });

  for (const c of vector.hkdf.mustReject) {
    void test(`hkdf mustReject: ${c.label}`, () => {
      const out = deriveKey({ ikm: hex(c.ikmHex), salt: hex(c.saltHex), purpose: c.purpose, length: c.lengthBytes });
      assert.equal(out.ok, false);
    });
  }

  void test("argon2id output", async () => {
    const out = await deriveKeyFromPassword(
      utf8(vector.argon2id.passwordUtf8),
      hex(vector.argon2id.saltHex),
      vector.argon2id.params,
    );
    assert.ok(out.ok);
    assert.equal(bytesToHex(out.value), vector.argon2id.outputHex);
  });

  const downgrades: [string, Partial<Argon2Params>][] = [
    ["m=8", { memoryKiB: 8 }],
    ["m=19455", { memoryKiB: 19_455 }],
    ["m=4194304", { memoryKiB: 4_194_304 }],
    ["m non-integer", { memoryKiB: 65_536.5 }],
    ["t=1", { iterations: 1 }],
    ["t=17", { iterations: 17 }],
    ["t non-integer", { iterations: 2.5 }],
    ["p=0", { parallelism: 0 }],
    ["p=5", { parallelism: 5 }],
    ["hashLength=15", { hashLength: 15 }],
    ["hashLength=65", { hashLength: 65 }],
  ];

  for (const [label, patch] of downgrades) {
    void test(`validateArgon2Params rejects ${label}`, () => {
      assert.equal(validateArgon2Params({ ...ARGON2_PARAMS_V1, ...patch }).ok, false);
    });
  }

  void test("validateArgon2Params accepts v1 params", () => {
    assert.equal(validateArgon2Params(ARGON2_PARAMS_V1).ok, true);
  });

  void test("argon2id rejects short salt and empty password", async () => {
    assert.equal((await deriveKeyFromPassword(utf8("x"), hex("02".repeat(15)), ARGON2_PARAMS_V1)).ok, false);
    assert.equal((await deriveKeyFromPassword(new Uint8Array(0), hex("02".repeat(16)), ARGON2_PARAMS_V1)).ok, false);
  });
});

void describe("key-hierarchy.json", () => {
  const vector = load("key-hierarchy") as KeyHierarchyVectors;

  void test("muk, auth key, wrapping key", async () => {
    const secretKey = toSecretKey(hex(vector.input.secretKeyHex));
    assert.ok(secretKey.ok);
    const accountSalt = toAccountSalt(hex(vector.input.accountSaltHex));
    assert.ok(accountSalt.ok);

    const muk = await deriveMasterUnlockKey({
      masterPassword: utf8(vector.input.masterPassword),
      secretKey: secretKey.value,
      accountSalt: accountSalt.value,
      argon2: vector.input.argon2,
    });
    assert.ok(muk.ok);
    assert.equal(bytesToHex(muk.value), vector.expected.mukHex);

    const keys = deriveAccountKeys(muk.value, accountSalt.value);
    assert.ok(keys.ok);
    assert.equal(bytesToHex(keys.value.authKey), vector.expected.authKeyHex);
    assert.equal(bytesToHex(keys.value.wrappingKey), vector.expected.wrappingKeyHex);
    assert.equal(encodeAuthKey(keys.value.authKey), vector.expected.authKeyBase64Url);
  });
});

void describe("secret-key.json", () => {
  const vector = load("secret-key") as SecretKeyVectors;

  for (const c of vector.formatted) {
    void test(`format: ${c.formatted}`, () => {
      const key = toSecretKey(hex(c.bytesHex));
      assert.ok(key.ok);
      assert.equal(formatSecretKey(key.value), c.formatted);
    });
  }

  for (const input of vector.parseLenient.inputs) {
    void test(`parseLenient: "${input}"`, () => {
      const parsed = parseSecretKey(input);
      assert.ok(parsed.ok);
      assert.equal(bytesToHex(parsed.value), vector.parseLenient.expectedHex);
    });
  }

  for (const input of vector.mustReject) {
    void test(`mustReject: "${input}"`, () => {
      assert.equal(parseSecretKey(input).ok, false);
    });
  }
});

void describe("aead.json", () => {
  const vector = load("aead") as AeadVectors;
  const { decrypt } = vector;

  void test("aad construction", () => {
    assert.equal(bytesToHex(utf8(vector.aadConstruction.example.combined)), vector.aadConstruction.example.combinedHex);
  });

  void test("decrypt fixed envelope", async () => {
    const key = await importAeadKey(hex(decrypt.keyHex));
    assert.ok(key.ok);
    const opened = await openFromEnvelope(key.value, decrypt.envelope, utf8(itemAad(decrypt.itemId, decrypt.version)));
    assert.ok(opened.ok);
    assert.equal(bytesToHex(opened.value), decrypt.expectedPlaintextHex);
    const text = bytesToUtf8(opened.value);
    assert.ok(text.ok);
    assert.equal(text.value, decrypt.expectedPlaintext);
  });

  void test("mustFail present", () => {
    assert.ok(vector.mustFail.length > 0);
  });

  for (const c of vector.mustFail) {
    void test(`mustFail: ${c.reason}`, async () => {
      const key = await importAeadKey(hex(decrypt.keyHex));
      assert.ok(key.ok);
      const envelope = withEnvelope(decrypt.envelope, c.envelopeAlg, c.envelopeVersion);
      const aad = utf8(itemAad(c.itemId ?? decrypt.itemId, c.version ?? decrypt.version));
      assert.equal((await openFromEnvelope(key.value, envelope, aad)).ok, false);
    });
  }

  void test("seal/open round-trip and aad binding", async () => {
    const key = await importAeadKey(hex(decrypt.keyHex));
    assert.ok(key.ok);
    const aad = utf8(itemAad(decrypt.itemId, decrypt.version));
    const message = utf8("ข้อความทดสอบ");
    const sealed = await sealToEnvelope(key.value, message, aad);
    assert.ok(sealed.ok);
    const opened = await openFromEnvelope(key.value, sealed.value, aad);
    assert.ok(opened.ok);
    assert.equal(bytesToHex(opened.value), bytesToHex(message));
    assert.equal((await openFromEnvelope(key.value, sealed.value, utf8(itemAad(decrypt.itemId, 999)))).ok, false);
  });
});

void describe("protocol.json", () => {
  const vector = load("protocol") as ProtocolVectors;

  for (const c of vector.itemAad) {
    void test(`itemAad v${String(c.version)}`, () => {
      assert.equal(itemAad(c.itemId, c.version), c.aad);
      assert.equal(bytesToHex(utf8(c.aad)), c.aadHex);
    });
  }

  for (const c of vector.vaultMetaAad) {
    void test(`vaultMetaAad v${String(c.version)}`, () => {
      assert.equal(`kunjae.v1.vault-meta|${c.vaultId}|${String(c.version)}`, c.aad);
      assert.equal(bytesToHex(utf8(c.aad)), c.aadHex);
    });
  }

  void test("vaultKeyAad present", () => {
    assert.ok(vector.vaultKeyAad.length > 0);
  });

  for (const c of vector.vaultKeyAad) {
    void test(`vaultKeyAad ${c.vaultId}`, () => {
      assert.equal(`kunjae.v1.vault-key|${c.vaultId}`, c.aad);
      assert.equal(bytesToHex(utf8(c.aad)), c.aadHex);
    });
  }
});

void describe("vault-key.json", () => {
  const vector = load("vault-key") as VaultKeyVectors;
  const { unwrap } = vector;
  const wrappingKey = (value: string): WrappingKey => hex(value) as WrappingKey;

  void test("unwrap fixed wrapped vault key", async () => {
    const wrapped = toWrappedVaultKey(unwrap.wrapped);
    assert.ok(wrapped.ok);
    const out = await unwrapVaultKey(wrappingKey(unwrap.wrappingKeyHex), wrapped.value, unwrap.vaultId);
    assert.ok(out.ok);
    assert.equal(bytesToHex(out.value), unwrap.expectedVaultKeyHex);
  });

  void test("fixed envelope opens with kunjae.v1.vault-key aad", async () => {
    const key = await importAeadKey(hex(unwrap.wrappingKeyHex));
    assert.ok(key.ok);
    const opened = await openFromEnvelope(key.value, unwrap.wrapped, utf8(`kunjae.v1.vault-key|${unwrap.vaultId}`));
    assert.ok(opened.ok);
    assert.equal(bytesToHex(opened.value), unwrap.expectedVaultKeyHex);
  });

  void test("mustFail present", () => {
    assert.ok(vector.mustFail.length > 0);
  });

  for (const c of vector.mustFail) {
    void test(`mustFail: ${c.reason}`, async () => {
      const envelope = withEnvelope(unwrap.wrapped, c.envelopeAlg, c.envelopeVersion);
      const out = await unwrapVaultKey(
        wrappingKey(c.wrappingKeyHex ?? unwrap.wrappingKeyHex),
        envelope as never,
        c.vaultId ?? unwrap.vaultId,
      );
      assert.equal(out.ok, false);
    });
  }

  void test("wrap/unwrap round-trip binds vaultId", async () => {
    const key = wrappingKey(unwrap.wrappingKeyHex);
    const vaultKey = hex(unwrap.expectedVaultKeyHex);
    const wrapped = await wrapVaultKey(key, vaultKey as never, unwrap.vaultId);
    assert.ok(wrapped.ok);
    const out = await unwrapVaultKey(key, wrapped.value, unwrap.vaultId);
    assert.ok(out.ok);
    assert.equal(bytesToHex(out.value), unwrap.expectedVaultKeyHex);
    assert.equal((await unwrapVaultKey(key, wrapped.value, `${unwrap.vaultId}X`)).ok, false);
  });
});

void describe("totp.json", () => {
  const vector = load("totp") as TotpVectors;

  for (const c of vector.rfc6238) {
    void test(`rfc6238 T=${String(c.unixSeconds)} ${c.algorithm}`, () => {
      const out = totp(hex(c.seedHex), c.unixSeconds * 1000, {
        algorithm: c.algorithm,
        digits: c.digits,
        periodSeconds: c.periodSeconds,
      });
      assert.ok(out.ok);
      assert.equal(out.value.code, c.code);
    });
  }

  for (const c of vector.rfc4226) {
    void test(`rfc4226 counter=${String(c.counter)}`, () => {
      const out = hotp(hex(c.seedHex), BigInt(c.counter), { algorithm: "SHA1", digits: c.digits, periodSeconds: 30 });
      assert.ok(out.ok);
      assert.equal(out.value, c.code);
    });
  }

  for (const c of vector.decode) {
    void test(`decode: ${c.label}`, () => {
      const out = decodeTotpSecret(c.text);
      assert.ok(out.ok);
      assert.equal(bytesToHex(out.value), c.bytesHex);
    });
  }

  for (const c of vector.rejectDecode) {
    void test(`rejectDecode: ${c.label}`, () => {
      assert.equal(decodeTotpSecret(c.text).ok, false);
    });
  }
});

void test("deriveKey256 rejects salt shorter than 16 bytes", () => {
  assert.equal(deriveKey256(hex("0b".repeat(32)), hex("22".repeat(15)), KEY_PURPOSE.AUTHENTICATION).ok, false);
  assert.equal(deriveKey256(hex("0b".repeat(32)), hex("22".repeat(16)), KEY_PURPOSE.AUTHENTICATION).ok, true);
});
