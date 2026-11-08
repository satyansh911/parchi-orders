// Language precedence (D72):
//   1. before login: the device cookie `parchi_locale`;
//   2. after login: the user's saved User.locale;
//   3. neither: Hindi.

import type { Locale } from "./messages";

export const LOCALE_COOKIE = "parchi_locale";
export const LOCALE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export function parseLocale(value: unknown): Locale | null {
  return value === "hi" || value === "en" ? value : null;
}

/** User.locale is the Prisma enum "HI" | "EN". */
export function fromUserLocale(value: "HI" | "EN"): Locale {
  return value === "EN" ? "en" : "hi";
}

export function toUserLocale(locale: Locale): "HI" | "EN" {
  return locale === "en" ? "EN" : "HI";
}

export function resolveLocale(input: { userLocale: "HI" | "EN" | null; cookie: string | undefined }): Locale {
  if (input.userLocale) return fromUserLocale(input.userLocale);
  return parseLocale(input.cookie) ?? "hi";
}
