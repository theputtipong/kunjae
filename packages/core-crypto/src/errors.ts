import type { Result } from "./result.ts";

export type Literal<S extends string> = string extends S ? never : S;

export type EncodingName = "hex" | "base32" | "base64url" | "utf8";

export type InvalidEncoding = {
  readonly kind: "InvalidEncoding";
  readonly encoding: EncodingName;
};

export type InvalidLength = {
  readonly kind: "InvalidLength";
  readonly field: string;
  readonly expected: number;
  readonly actual: number;
};

export type InvalidParameter = {
  readonly kind: "InvalidParameter";
  readonly parameter: string;
};

export type InvalidFormat = {
  readonly kind: "InvalidFormat";
  readonly format: string;
};

export type UnsupportedAlgorithm = {
  readonly kind: "UnsupportedAlgorithm";
  readonly algorithm: string;
};

export type RandomSourceUnavailable = {
  readonly kind: "RandomSourceUnavailable";
};

export type SubtleCryptoUnavailable = {
  readonly kind: "SubtleCryptoUnavailable";
};

export type KeyDerivationFailed = {
  readonly kind: "KeyDerivationFailed";
};

export type EncryptionFailed = {
  readonly kind: "EncryptionFailed";
};

export type DecryptionFailed = {
  readonly kind: "DecryptionFailed";
};

export type CryptoError =
  | InvalidEncoding
  | InvalidLength
  | InvalidFormat
  | InvalidParameter
  | UnsupportedAlgorithm
  | RandomSourceUnavailable
  | SubtleCryptoUnavailable
  | KeyDerivationFailed
  | EncryptionFailed
  | DecryptionFailed;

export type CryptoErrorKind = CryptoError["kind"];

export type CryptoResult<T> = Result<T, CryptoError>;

export const invalidEncoding = (encoding: EncodingName): InvalidEncoding => ({
  kind: "InvalidEncoding",
  encoding,
});

export const invalidLength = <F extends string>(
  field: Literal<F>,
  expected: number,
  actual: number,
): InvalidLength => ({ kind: "InvalidLength", field, expected, actual });

export const invalidFormat = <F extends string>(format: Literal<F>): InvalidFormat => ({
  kind: "InvalidFormat",
  format,
});

export const invalidParameter = <P extends string>(
  parameter: Literal<P>,
): InvalidParameter => ({ kind: "InvalidParameter", parameter });

export const unsupportedAlgorithm = <A extends string>(
  algorithm: Literal<A>,
): UnsupportedAlgorithm => ({ kind: "UnsupportedAlgorithm", algorithm });

export const randomSourceUnavailable = (): RandomSourceUnavailable => ({
  kind: "RandomSourceUnavailable",
});

export const subtleCryptoUnavailable = (): SubtleCryptoUnavailable => ({
  kind: "SubtleCryptoUnavailable",
});

export const keyDerivationFailed = (): KeyDerivationFailed => ({
  kind: "KeyDerivationFailed",
});

export const encryptionFailed = (): EncryptionFailed => ({ kind: "EncryptionFailed" });

export const decryptionFailed = (): DecryptionFailed => ({ kind: "DecryptionFailed" });

const KNOWN_KINDS: ReadonlySet<string> = new Set<CryptoErrorKind>([
  "InvalidEncoding",
  "InvalidLength",
  "InvalidFormat",
  "InvalidParameter",
  "UnsupportedAlgorithm",
  "RandomSourceUnavailable",
  "SubtleCryptoUnavailable",
  "KeyDerivationFailed",
  "EncryptionFailed",
  "DecryptionFailed",
]);

export const isCryptoError = (value: unknown): value is CryptoError =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  typeof value.kind === "string" &&
  KNOWN_KINDS.has(value.kind);
