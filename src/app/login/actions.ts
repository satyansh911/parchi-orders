"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requestLoginCode, verifyLoginCode, type LoginError } from "@/server/auth/login-service";
import { otpProviderFromEnv } from "@/server/auth/otp";
import { safeNextPath } from "@/server/auth/redirects";
import { clearSessionCookie, readSessionToken, writeSessionCookie } from "@/server/auth/session-cookie";
import { revokeSession } from "@/server/auth/session-store";
import { db } from "@/server/db";

// Thin Next.js wrappers around the tested login service. Strict schemas
// reject unknown keys, so a client can't slip in a role or retailerId.

const deps = () => ({ db, otp: otpProviderFromEnv(), now: () => new Date() });

const requestInput = z.strictObject({ phone: z.string().max(20) });
const verifyInput = z.strictObject({
  phone: z.string().max(20),
  code: z.string().max(10),
  next: z.string().max(512).optional(),
});

export type LoginActionResult = { ok: true; phone: string } | { ok: false; error: LoginError | "INVALID_INPUT" };

export async function requestOtpAction(raw: unknown): Promise<LoginActionResult> {
  const input = requestInput.safeParse(raw);
  if (!input.success) return { ok: false, error: "INVALID_INPUT" };
  const result = await requestLoginCode(deps(), input.data.phone);
  return result.ok ? { ok: true, phone: result.phone } : result;
}

export async function verifyOtpAction(raw: unknown): Promise<LoginActionResult> {
  const input = verifyInput.safeParse(raw);
  if (!input.success) return { ok: false, error: "INVALID_INPUT" };
  const result = await verifyLoginCode(deps(), input.data, await readSessionToken());
  if (!result.ok) return result;
  await writeSessionCookie(result.token, result.expiresAt);
  redirect(safeNextPath(input.data.next, result.role));
}

/** POST only (form action). Revokes just this device's session (D61). */
export async function logoutAction(): Promise<void> {
  const token = await readSessionToken();
  if (token) await revokeSession(db, token);
  await clearSessionCookie();
  redirect("/login");
}
