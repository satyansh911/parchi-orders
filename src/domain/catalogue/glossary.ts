// The shop-word glossary (DECISIONS #9), one source for catalogue search and
// AI capture. Words map to what they should match in product data.

/** Each spoken/shop word → the words it should match in product data. */
export const SYNONYMS: Readonly<Record<string, readonly string[]>> = {
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
export const FILLER_WORDS: ReadonlySet<string> = new Set(["wala", "vala", "wali", "ka", "ki", "ke", "peti", "pack", "packet", "bhaiya", "bhai", "aur", "and", "bhi", "de", "dena", "do", "chahiye"]);

/** D9: "chhota" = smallest available pack, "bada" = largest. */
export const SMALLEST_WORDS: ReadonlySet<string> = new Set(["chhota", "chota", "chhote", "chote", "chhoti", "choti", "small", "छोटा", "छोटे", "छोटी"]);
export const LARGEST_WORDS: ReadonlySet<string> = new Set(["bada", "bade", "badi", "big", "large", "बड़ा", "बड़े", "बड़ी"]);

/** Explicit case words. "Dabba" is NOT here: D9 says it is box or case depending on context, so it is asked. */
export const CASE_WORDS: ReadonlySet<string> = new Set(["peti", "petti", "peti.", "case", "cases", "पेटी", "पेटियाँ"]);
/** Piece/packet words: never converted to cases (D3). */
export const PIECE_WORDS: ReadonlySet<string> = new Set(["packet", "packets", "pkt", "pkts", "pc", "pcs", "piece", "pieces", "nag", "पैकेट", "पीस"]);
/** Pack-size unit words that follow a pack number ("250 wala", "1 kilo"). */
export const PACK_UNIT_WORDS: ReadonlySet<string> = new Set(["g", "gm", "gms", "gram", "grams", "kg", "kilo", "ml", "l", "ltr", "litre", "liter", "wala", "vala", "wali", "ग्राम", "किलो", "लीटर", "वाला", "वाली"]);

/** The D9 table as plain lines for the AI prompt. */
export const GLOSSARY_FOR_PROMPT: readonly string[] = [
  "peti / पेटी = case (the ordering unit)",
  "dabba = box or case depending on context (do not assume)",
  "chhota = smallest available pack; bada = largest available pack",
  "washing powder = detergent powder",
  "chai patti = tea leaf (not tea dust)",
  "biscuit = a biscuit product",
  "1 kilo / 1 kg = the 1 kg variant; 250 wala = the 250 g variant",
  "packet / pc / piece = a single consumer pack, NOT a case",
];
