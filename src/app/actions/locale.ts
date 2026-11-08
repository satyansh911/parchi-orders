"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, toUserLocale } from "@/i18n/locale";
import { action } from "@/server/auth/action";
import { isHttpsRequest } from "@/server/auth/cookie-config";
import { protocolContext } from "@/server/auth/session-cookie";
import { db } from "@/server/db";

/**
 * Language toggle (D72). Always sets the device cookie; when signed in, also
 * saves the choice to the account. PUBLIC so it works on the login screen.
 */
export const setLocaleAction = action({
  role: "PUBLIC",
  input: z.object({ locale: z.enum(["hi", "en"]) }),
  handler: async ({ locale }, { viewer }) => {
    (await cookies()).set(LOCALE_COOKIE, locale, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE,
      secure: isHttpsRequest(await protocolContext()),
    });
    if (viewer) await db.user.update({ where: { id: viewer.userId }, data: { locale: toUserLocale(locale) } });
    return { locale };
  },
});
