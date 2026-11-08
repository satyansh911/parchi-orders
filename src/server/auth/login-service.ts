// Login flow, independent of Next.js so it can be tested against Postgres.
// - Unknown numbers and wrong codes get the SAME error (D62/Phase 0 contract),
//   so the login screen never reveals who is registered.
// - No OTP provider configured (AUTH_DEMO_OTP not "true") = login refused (D55).
// - A successful login rotates the device's session (no session fixation).
// - Brute-force limits (D56) reserve an attempt before the code is checked.

import type { PrismaClient } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { allowCodeRequest, reserveCodeCheck } from "./login-limits";
import { OTP_CODE_PATTERN, type OtpProvider } from "./otp";
import { normalisePhone } from "./phone";
import { rotateSession } from "./session-store";

export type LoginDeps = {
  db: PrismaClient;
  otp: OtpProvider | null;
  now: () => Date;
  /** From clientIp(): trusted only on Vercel. */
  clientIp: string;
};

export type LoginError = "LOGIN_DISABLED" | "INVALID_PHONE" | "INVALID_CREDENTIALS" | "RATE_LIMITED";

export type RequestCodeResult =
  | { ok: true; phone: string; demoCode: string | null }
  | { ok: false; error: LoginError };

export type VerifyCodeResult =
  | { ok: true; token: string; expiresAt: Date; role: Role }
  | { ok: false; error: LoginError };

/** Step 1: ask for a code. Same answer whether or not the number is registered. */
export async function requestLoginCode(deps: LoginDeps, rawPhone: unknown): Promise<RequestCodeResult> {
  if (!deps.otp) return { ok: false, error: "LOGIN_DISABLED" };
  const phone = normalisePhone(rawPhone);
  if (!phone) return { ok: false, error: "INVALID_PHONE" };
  if (!(await allowCodeRequest(deps.db, phone, deps.now()))) return { ok: false, error: "RATE_LIMITED" };
  await deps.otp.sendCode(phone);
  return { ok: true, phone, demoCode: deps.otp.demoCode };
}

/** Step 2: check the code and start a session. */
export async function verifyLoginCode(
  deps: LoginDeps,
  input: { phone: unknown; code: unknown },
  previousToken: string | undefined,
): Promise<VerifyCodeResult> {
  if (!deps.otp) return { ok: false, error: "LOGIN_DISABLED" };
  const now = deps.now();
  const phone = normalisePhone(input.phone);

  // Reserve the attempt BEFORE checking anything, so simultaneous guesses
  // can't exceed the limit; while locked, even the right code is refused.
  const reservation = await reserveCodeCheck(deps.db, phone, deps.clientIp, now);
  if (!reservation.allowed) return { ok: false, error: "RATE_LIMITED" };

  const code = typeof input.code === "string" ? input.code.trim() : "";
  if (!phone || !OTP_CODE_PATTERN.test(code)) return { ok: false, error: "INVALID_CREDENTIALS" };

  const codeOk = await deps.otp.checkCode(phone, code);
  const user = await deps.db.user.findUnique({ where: { phone }, select: { id: true, role: true } });
  if (!codeOk || !user) return { ok: false, error: "INVALID_CREDENTIALS" };

  await reservation.succeeded(); // a successful login is not a failed attempt
  const { token, expiresAt } = await rotateSession(deps.db, previousToken, user.id, now);
  return { ok: true, token, expiresAt, role: user.role };
}
