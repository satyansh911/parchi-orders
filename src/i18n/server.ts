import "server-only";
import { cookies } from "next/headers";
import { getViewer } from "@/server/auth/viewer";
import { LOCALE_COOKIE, resolveLocale } from "./locale";
import { translator, type Locale, type MessageKey, type Translate } from "./messages";

/** The request's locale by D72 precedence: account language, else device cookie, else Hindi. */
export async function getLocale(): Promise<Locale> {
  const viewer = await getViewer();
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  return resolveLocale({ userLocale: viewer?.locale ?? null, cookie });
}

export async function getTranslator(): Promise<{ locale: Locale; t: Translate }> {
  const locale = await getLocale();
  return { locale, t: translator(locale) };
}

/** Only the strings a client component needs, so dictionaries never ship in the JS bundle. */
export function pickStrings<K extends MessageKey>(t: Translate, keys: readonly K[]): Record<K, string> {
  return Object.fromEntries(keys.map((k) => [k, t(k)])) as Record<K, string>;
}
