import type { Result } from "@kunjae/core-crypto";

export type UniqueViolation = {
  readonly kind: "UniqueViolation";
};

export type ConstraintViolation = {
  readonly kind: "ConstraintViolation";
};

export type DbUnavailable = {
  readonly kind: "DbUnavailable";
};

export type DbError = UniqueViolation | ConstraintViolation | DbUnavailable;

export type DbResult<T> = Result<T, DbError>;

export const uniqueViolation = (): UniqueViolation => ({ kind: "UniqueViolation" });
export const constraintViolation = (): ConstraintViolation => ({ kind: "ConstraintViolation" });
export const dbUnavailable = (): DbUnavailable => ({ kind: "DbUnavailable" });

export const classifyDbError = (cause: unknown): DbError => {
  const message = cause instanceof Error ? cause.message : "";

  if (message.includes("UNIQUE constraint failed")) return uniqueViolation();

  if (
    message.includes("CHECK constraint failed") ||
    message.includes("FOREIGN KEY constraint failed") ||
    message.includes("NOT NULL constraint failed")
  ) {
    return constraintViolation();
  }

  return dbUnavailable();
};
