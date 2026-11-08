// Locale-independent message helpers, safe for server and client.

import { en, type MessageKey } from "./en";
import { hi } from "./hi";

export type Locale = "hi" | "en";
export type { MessageKey };

export const dictionaries: Record<Locale, Record<MessageKey, string>> = { hi, en };

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** A translator for one locale. Unknown {placeholders} are left visible, never silently dropped. */
export function translator(locale: Locale): Translate {
  const dict = dictionaries[locale];
  return (key, vars) =>
    dict[key].replace(/\{(\w+)\}/g, (match, name: string) => (vars && name in vars ? String(vars[name]) : match));
}
