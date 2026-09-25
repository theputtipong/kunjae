import { ok, err, fromThrowable, type Result } from "../result.ts";
import { constant } from "../fn.ts";
import { invalidEncoding, type CryptoError } from "../errors.ts";
import type { Bytes } from "../types.ts";

type EncodingResult<T> = Result<T, Extract<CryptoError, { kind: "InvalidEncoding" }>>;

const HEX_ALPHABET = "0123456789abcdef";

export const bytesToHex = (bytes: Bytes): string => {
  let out = "";
  for (const byte of bytes) {
    out += HEX_ALPHABET.charAt(byte >> 4) + HEX_ALPHABET.charAt(byte & 15);
  }
  return out;
};

const hexCharValue = (code: number): number => {
  if (code >= 48 && code <= 57) return code - 48;
  if (code >= 97 && code <= 102) return code - 87;
  if (code >= 65 && code <= 70) return code - 55;
  return -1;
};

export const hexToBytes = (hex: string): EncodingResult<Bytes> => {
  if (hex.length % 2 !== 0) return err(invalidEncoding("hex"));

  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    const hi = hexCharValue(hex.charCodeAt(i * 2));
    const lo = hexCharValue(hex.charCodeAt(i * 2 + 1));
    if (hi < 0 || lo < 0) return err(invalidEncoding("hex"));
    out[i] = (hi << 4) | lo;
  }
  return ok(out);
};

const B64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const B64URL_INVALID = 0xff;

const B64URL_LOOKUP: Bytes = (() => {
  const table = new Uint8Array(128).fill(B64URL_INVALID);
  for (let i = 0; i < B64URL_ALPHABET.length; i += 1) {
    table[B64URL_ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

export const bytesToBase64Url = (bytes: Bytes): string => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];

    out += B64URL_ALPHABET.charAt(b0 >> 2);
    out += B64URL_ALPHABET.charAt(((b0 & 0b11) << 4) | ((b1 ?? 0) >> 4));
    if (b1 === undefined) break;
    out += B64URL_ALPHABET.charAt(((b1 & 0b1111) << 2) | ((b2 ?? 0) >> 6));
    if (b2 === undefined) break;
    out += B64URL_ALPHABET.charAt(b2 & 0b111111);
  }
  return out;
};

export const base64UrlToBytes = (text: string): EncodingResult<Bytes> => {
  const len = text.length;
  if (len % 4 === 1) return err(invalidEncoding("base64url"));

  const out = new Uint8Array(Math.floor((len * 3) / 4));

  let outIndex = 0;
  let buffer = 0;
  let bitsInBuffer = 0;

  for (let i = 0; i < len; i += 1) {
    const code = text.charCodeAt(i);
    const value = code < 128 ? (B64URL_LOOKUP[code] ?? B64URL_INVALID) : B64URL_INVALID;
    if (value === B64URL_INVALID) return err(invalidEncoding("base64url"));

    buffer = (buffer << 6) | value;
    bitsInBuffer += 6;

    if (bitsInBuffer >= 8) {
      bitsInBuffer -= 8;
      out[outIndex] = (buffer >> bitsInBuffer) & 0xff;
      outIndex += 1;
    }
  }

  if (bitsInBuffer > 0 && (buffer & ((1 << bitsInBuffer) - 1)) !== 0) {
    return err(invalidEncoding("base64url"));
  }

  return ok(out);
};

const B32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const B32_INVALID = -1;

const B32_LOOKUP: Int8Array = (() => {
  const table = new Int8Array(128).fill(B32_INVALID);

  for (let i = 0; i < B32_ALPHABET.length; i += 1) {
    const upper = B32_ALPHABET.charCodeAt(i);
    table[upper] = i;
    table[upper + 32] = i;
  }

  const ONE = B32_ALPHABET.indexOf("1");
  const ZERO = B32_ALPHABET.indexOf("0");
  for (const ch of ["i", "I", "l", "L"]) table[ch.charCodeAt(0)] = ONE;
  for (const ch of ["o", "O"]) table[ch.charCodeAt(0)] = ZERO;

  return table;
})();

const B32_IMPOSSIBLE_REMAINDERS: ReadonlySet<number> = new Set([1, 3, 6]);

export const bytesToBase32 = (bytes: Bytes): string => {
  let out = "";
  let buffer = 0;
  let bitsInBuffer = 0;

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bitsInBuffer += 8;

    while (bitsInBuffer >= 5) {
      bitsInBuffer -= 5;
      out += B32_ALPHABET.charAt((buffer >> bitsInBuffer) & 0b11111);
    }
  }

  if (bitsInBuffer > 0) {
    out += B32_ALPHABET.charAt((buffer << (5 - bitsInBuffer)) & 0b11111);
  }

  return out;
};

export const base32ToBytes = (text: string): EncodingResult<Bytes> => {
  const len = text.length;
  if (B32_IMPOSSIBLE_REMAINDERS.has(len % 8)) return err(invalidEncoding("base32"));

  const out = new Uint8Array(Math.floor((len * 5) / 8));

  let outIndex = 0;
  let buffer = 0;
  let bitsInBuffer = 0;

  for (let i = 0; i < len; i += 1) {
    const code = text.charCodeAt(i);
    const value = code < 128 ? (B32_LOOKUP[code] ?? B32_INVALID) : B32_INVALID;
    if (value === B32_INVALID) return err(invalidEncoding("base32"));

    buffer = (buffer << 5) | value;
    bitsInBuffer += 5;

    if (bitsInBuffer >= 8) {
      bitsInBuffer -= 8;
      out[outIndex] = (buffer >> bitsInBuffer) & 0xff;
      outIndex += 1;
    }
  }

  if (bitsInBuffer > 0 && (buffer & ((1 << bitsInBuffer) - 1)) !== 0) {
    return err(invalidEncoding("base32"));
  }

  return ok(out);
};

const TEXT_ENCODER = new TextEncoder();

const toOwnBuffer = (bytes: Uint8Array): Bytes => new Uint8Array(bytes);

const TEXT_DECODER = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });

const LONE_SURROGATE = /\p{Surrogate}/u;

export const utf8ToBytes = (text: string): EncodingResult<Bytes> =>
  LONE_SURROGATE.test(text) ? err(invalidEncoding("utf8")) : ok(toOwnBuffer(TEXT_ENCODER.encode(text)));

export const bytesToUtf8 = (bytes: Bytes): EncodingResult<string> =>
  fromThrowable(
    () => TEXT_DECODER.decode(bytes),
    constant(invalidEncoding("utf8")),
  );
