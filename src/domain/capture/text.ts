// Deterministic reading of a capture line's original words: numbers (digits,
// Devanagari digits, Hindi/Hinglish number words), unit words and product words.

import { CASE_WORDS, FILLER_WORDS, LARGEST_WORDS, PACK_UNIT_WORDS, PIECE_WORDS, SMALLEST_WORDS, SYNONYMS } from "../catalogue/glossary";

export function normaliseText(text: string): string {
  return text.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function tokens(text: string): string[] {
  return normaliseText(text)
    .replace(/[०-९]/g, (d) => String("०१२३४५६७८९".indexOf(d)))
    .replace(/(\d)([a-zऀ-ॿ])/g, "$1 $2") // "250g" → "250 g", "1kg" → "1 kg"
    .split(/[\s,.;:!?()/\\-]+/)
    .filter(Boolean);
}

const NUMBER_WORDS: Record<string, number> = {
  ek: 1, do: 2, teen: 3, tin: 3, char: 4, chaar: 4, paanch: 5, panch: 5, pach: 5, chhe: 6, chhah: 6, che: 6, saat: 7, sat: 7,
  aath: 8, ath: 8, nau: 9, das: 10, dus: 10, gyarah: 11, barah: 12, baarah: 12, pandrah: 15, bees: 20, pachchis: 25, tees: 30, pachas: 50,
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, छह: 6, छः: 6, सात: 7, आठ: 8, नौ: 9, दस: 10, ग्यारह: 11, बारह: 12, पंद्रह: 15, बीस: 20, पच्चीस: 25, तीस: 30, पचास: 50,
};

/** Every number in the words, with whether it is followed by a pack-size unit ("250 wala", "1 kilo"). */
export function numbersIn(text: string): Array<{ value: number; packUnitAfter: boolean }> {
  const t = tokens(text);
  const out: Array<{ value: number; packUnitAfter: boolean }> = [];
  t.forEach((tok, i) => {
    const value = /^\d+(\.\d+)?$/.test(tok) ? Number(tok) : NUMBER_WORDS[tok];
    if (value !== undefined && Number.isFinite(value)) out.push({ value, packUnitAfter: PACK_UNIT_WORDS.has(t[i + 1] ?? "") });
  });
  return out;
}

export type UnitWord = "CASE" | "PIECE" | "UNKNOWN";

/** Only explicit words count (D3, D97): no unit word → ask. */
export function unitIn(text: string): UnitWord {
  const t = tokens(text);
  if (t.some((w) => PIECE_WORDS.has(w))) return "PIECE";
  if (t.some((w) => CASE_WORDS.has(w))) return "CASE";
  return "UNKNOWN";
}

export const mentionsSmallest = (text: string) => tokens(text).some((w) => SMALLEST_WORDS.has(w));
export const mentionsLargest = (text: string) => tokens(text).some((w) => LARGEST_WORDS.has(w));

/** The words that describe the product (no numbers, units, size words or filler). */
export function productWords(text: string): string[] {
  return tokens(text).filter(
    (w) =>
      !/^\d/.test(w) && !(w in NUMBER_WORDS) && !CASE_WORDS.has(w) && !PIECE_WORDS.has(w) && !PACK_UNIT_WORDS.has(w) &&
      !FILLER_WORDS.has(w) && !SMALLEST_WORDS.has(w) && !LARGEST_WORDS.has(w) && w !== "dabba" && w !== "डिब्बा",
  );
}

/** How many product words the item's own text supports (glossary-aware). */
export function supportCount(haystack: string, words: readonly string[]): number {
  const hay = normaliseText(haystack);
  return words.filter((w) => [w, ...(SYNONYMS[w] ?? [])].some((c) => hay.includes(c))).length;
}
