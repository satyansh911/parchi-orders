// Catalogue search (D82): every word of the query must match the product's
// English or Hindi name, brand, category, pack size or code. Common shop words
// from the glossary (DECISIONS #9) are understood: "chai patti" finds tea,
// "washing powder" finds detergent, "kilo" finds "kg".

export type Searchable = {
  code: string;
  nameEn: string;
  nameHi: string;
  brand: string;
  categoryEn: string;
  categoryHi: string;
  packSize: string;
};

/** Each spoken/shop word → the words it should match in product data. */
const SYNONYMS: Record<string, string[]> = {
  chai: ["tea", "चाय"],
  patti: ["leaf", "पत्ती"],
  washing: ["detergent"],
  powder: ["powder"],
  kilo: ["kg", "किलो"],
  kg: ["kg", "किलो"],
  gram: ["g", "ग्राम"],
  biskut: ["biscuit"],
  namkeen: ["namkeen", "snacks", "नमकीन"],
  sabun: ["bar", "soap", "साबुन"],
  masala: ["masala", "मसाला"],
};

/** Words that carry no product meaning in shop speech ("250 wala" = "250"). */
const IGNORED = new Set(["wala", "vala", "wali", "ka", "ki", "ke", "peti", "pack", "packet"]);

export function normaliseQuery(query: string): string[] {
  return query
    .toLowerCase()
    .normalize("NFC")
    .split(/[\s,]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && !IGNORED.has(w));
}

export function matchesQuery(item: Searchable, query: string): boolean {
  const words = normaliseQuery(query);
  if (words.length === 0) return true;
  const haystack = [item.code, item.nameEn, item.nameHi, item.brand, item.categoryEn, item.categoryHi, item.packSize]
    .join(" ")
    .toLowerCase()
    .normalize("NFC");
  return words.every((word) => [word, ...(SYNONYMS[word] ?? [])].some((candidate) => haystack.includes(candidate)));
}
