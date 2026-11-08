// Session tokens (D59). The browser holds the raw token; the database holds
// only its SHA-256 hash, so a database leak can't be used to log in.
// A 256-bit random token can't be guessed, so no secret or slow hash is needed.

import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;
/** base64url of 32 bytes, no padding. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Cheap shape check, so garbage cookies never reach the database. */
export function isWellFormedToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}
