"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LOCALE_COOKIE, parseLocale, toUserLocale } from "@/i18n/locale";
import { action } from "@/server/auth/action";
import { requestLoginCode, verifyLoginCode, type LoginError } from "@/server/auth/login-service";
import { otpProviderFromEnv } from "@/server/auth/otp";
import { safeNextPath } from "@/server/auth/redirects";
import { clearSessionCookie, readSessionToken, writeSessionCookie } from "@/server/auth/session-cookie";
import { revokeSession } from "@/server/auth/session-store";
import { db } from "@/server/db";
import { clientIp } from "@/server/http/client-ip";

// Login and logout, built with the common wrapper (D67) as PUBLIC actions:
// strict input (no role or retailerId can be slipped in), thin glue around
// the tested login service.

async function deps() {
  return { db, otp: otpProviderFromEnv(), now: () => new Date(), clientIp: clientIp(await headers(), process.env.VERCEL === "1") };
}

export type LoginOutcome = { phone: string } | { error: LoginError };

export const requestOtpAction = action({
  role: "PUBLIC",
  input: z.object({ phone: z.string().max(20) }),
  handler: async ({ phone }): Promise<LoginOutcome> => {
    const result = await requestLoginCode(await deps(), phone);
    return result.ok ? { phone: result.phone } : { error: result.error };
  },
});

export const verifyOtpAction = action({
  role: "PUBLIC",
  input: z.object({ phone: z.string().max(20), code: z.string().max(10), next: z.string().max(512).optional() }),
  handler: async (input): Promise<LoginOutcome> => {
    const result = await verifyLoginCode(await deps(), input, await readSessionToken());
    if (!result.ok) return { error: result.error };
    await writeSessionCookie(result.token, result.expiresAt);
    // D72: the language picked on the login screen is saved to the account.
    const picked = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
    if (picked) await db.user.update({ where: { id: result.userId }, data: { locale: toUserLocale(picked) } });
    redirect(safeNextPath(input.next, result.role));
  },
});

/**
 * POST only (a form action). PUBLIC so it still clears the cookie when the
 * session has already expired. Revokes just this device's session (D61).
 */
export const logoutAction = action({
  role: "PUBLIC",
  input: z.object({}),
  handler: async (): Promise<never> => {
    const token = await readSessionToken();
    if (token) await revokeSession(db, token);
    await clearSessionCookie();
    redirect("/login");
  },
});
