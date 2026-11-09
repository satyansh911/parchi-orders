import { describe, expect, it } from "vitest";
import { SKUS } from "../../../prisma/seed-data/catalogue";
import { postprocessCapture, type CaptureContext, type CaptureSku, type ModelLine } from "./postprocess";
import { numbersIn, productWords, unitIn } from "./text";

// The real demo catalogue, short IDs by SKU code (as the server builds them).
const skus: CaptureSku[] = [...SKUS]
  .sort((a, b) => a.code.localeCompare(b.code))
  .map((s, i) => ({
    id: s.code, shortId: `S${i + 1}`, code: s.code, nameEn: s.nameEn, nameHi: s.nameHi, brand: s.brand,
    categoryEn: s.category, categoryHi: s.category, packSize: s.packSize, piecesPerCase: s.piecesPerCase, availableCases: s.stockCases,
  }));
const short = (code: string) => skus.find((s) => s.code === code)!.shortId;
const ctx = (over: Partial<CaptureContext> = {}): CaptureContext => ({ skus, pastSkuIds: new Set(), aliases: new Map(), ...over });
const line = (raw: string, code: string | null, qty: number | null, score: number, alternatives: string[] = []): ModelLine => ({
  raw, sku: code ? short(code) : null, qty, unit: "CASE", score, alternatives: alternatives.map(short),
});
const run = (message: string, lines: ModelLine[], c = ctx(), unmatched: string[] = []) => postprocessCapture(message, { lines, unmatched }, c);

const BRIEF = "bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti";
const R0001_HISTORY = new Set(["SKU-BS-075", "SKU-DT-1KG", "SKU-TE-250"]);

describe("reading the words (D3, D9)", () => {
  it("finds numbers in digits, Devanagari digits and Hinglish/Hindi words", () => {
    expect(numbersIn("5 peti").map((n) => n.value)).toEqual([5]);
    expect(numbersIn("do peti chai").map((n) => n.value)).toEqual([2]);
    expect(numbersIn("तीन पेटी").map((n) => n.value)).toEqual([3]);
    expect(numbersIn("२ पेटी").map((n) => n.value)).toEqual([2]);
  });

  it("knows which numbers are pack sizes", () => {
    expect(numbersIn("chai patti 250 wala 1 peti")).toEqual([{ value: 250, packUnitAfter: true }, { value: 1, packUnitAfter: false }]);
    expect(numbersIn("washing powder 1kg")).toEqual([{ value: 1, packUnitAfter: true }]);
  });

  it("reads units only from explicit words; 'dabba' and no word are unknown", () => {
    expect(unitIn("5 peti biscuit")).toBe("CASE");
    expect(unitIn("5 पेटी बिस्कुट")).toBe("CASE");
    expect(unitIn("20 packet biscuit")).toBe("PIECE");
    expect(unitIn("5 dabba biscuit")).toBe("UNKNOWN");
    expect(unitIn("5 biscuit")).toBe("UNKNOWN");
  });

  it("keeps only product words", () => {
    expect(productWords("bhaiya 5 peti biscuit chhota")).toEqual(["biscuit"]);
    expect(productWords("2 peti washing powder 1 kilo")).toEqual(["washing", "powder"]);
  });
});

describe("the brief's sample message (R-0001 history)", () => {
  const lines = run(
    BRIEF,
    [
      line("5 peti biscuit chhota", "SKU-BS-075", 5, 88, ["SKU-BS-150", "SKU-CR-100"]),
      line("2 peti washing powder 1 kilo", "SKU-DT-1KG", 2, 92, ["SKU-DT-500", "SKU-DT-2KG"]),
      line("chai patti 250 wala 1 peti", "SKU-TE-250", 1, 90, ["SKU-TD-250", "SKU-TE-500"]),
    ],
    ctx({ pastSkuIds: R0001_HISTORY }),
  );

  it("maps all three lines to the right SKUs and case quantities", () => {
    expect(lines.map((l) => [l.suggestedSkuId, l.suggestedCases])).toEqual([["SKU-BS-075", 5], ["SKU-DT-1KG", 2], ["SKU-TE-250", 1]]);
  });

  it("is High for all three: words, pack size and history all agree", () => {
    expect(lines.map((l) => l.confidence)).toEqual(["HIGH", "HIGH", "HIGH"]);
  });

  it("keeps out-of-stock tea, flagged", () => {
    expect(lines[2].flags).toContain("OUT_OF_STOCK");
  });

  it("always offers two alternatives", () => {
    for (const l of lines) expect(l.alternativeSkuIds).toHaveLength(2);
  });
});

describe("evidence-based confidence (D97)", () => {
  it("a retailer with no history: generic 'biscuit' is at most Medium (other biscuits match equally)", () => {
    const [l] = run(BRIEF, [line("5 peti biscuit chhota", "SKU-BS-075", 5, 98)]);
    expect(l.flags).toContain("PRODUCT_UNCLEAR");
    expect(l.confidence).not.toBe("HIGH");
  });

  it("a model score of 95 does not make an unpinned pack size High: it needs clarification", () => {
    const [l] = run("2 peti washing powder", [line("2 peti washing powder", "SKU-DT-1KG", 2, 95)], ctx({ pastSkuIds: R0001_HISTORY }));
    expect(l.flags).toContain("PACK_SIZE_UNCLEAR");
    expect(l.confidence).toBe("NEEDS_CLARIFICATION");
  });

  it("past orders never override a pack-size ambiguity", () => {
    const [l] = run("1 peti chai patti", [line("1 peti chai patti", "SKU-TE-250", 1, 99)], ctx({ pastSkuIds: R0001_HISTORY }));
    expect(l.confidence).toBe("NEEDS_CLARIFICATION");
  });

  it("'chhota' pins the smallest pack; picking a bigger one with 'chhota' is not pinned", () => {
    const smallest = run("5 peti biscuit chhota", [line("5 peti biscuit chhota", "SKU-BS-075", 5, 90)], ctx({ pastSkuIds: R0001_HISTORY }));
    expect(smallest[0].flags).not.toContain("PACK_SIZE_UNCLEAR");
    const wrong = run("5 peti biscuit chhota", [line("5 peti biscuit chhota", "SKU-BS-150", 5, 90)], ctx({ pastSkuIds: new Set(["SKU-BS-150"]) }));
    expect(wrong[0].flags).toContain("PACK_SIZE_UNCLEAR");
  });

  it("applies D10: +10 for past orders, −15 otherwise", () => {
    const withHistory = run("2 peti washing powder 1 kilo", [line("2 peti washing powder 1 kilo", "SKU-DT-1KG", 2, 80)], ctx({ pastSkuIds: R0001_HISTORY }));
    const without = run("2 peti washing powder 1 kilo", [line("2 peti washing powder 1 kilo", "SKU-DT-1KG", 2, 80)]);
    expect(withHistory[0]).toMatchObject({ finalScore: 90, confidence: "HIGH" });
    expect(without[0]).toMatchObject({ finalScore: 65, confidence: "LOW" });
  });

  it("boundaries: 90 is High, 89 is Medium, 70 is Medium, 69 is Low", () => {
    const at = (score: number) => run("2 peti washing powder 1 kilo", [line("2 peti washing powder 1 kilo", "SKU-DT-1KG", 2, score)], ctx({ pastSkuIds: R0001_HISTORY }))[0].confidence;
    expect([at(80), at(79), at(60), at(59)]).toEqual(["HIGH", "MEDIUM", "MEDIUM", "LOW"]);
  });

  it("caps at Low when the words don't support the product at all (−20)", () => {
    const [l] = run("2 peti washing powder 1 kilo", [line("2 peti washing powder 1 kilo", "SKU-HG-050", 2, 99)], ctx({ pastSkuIds: new Set(["SKU-HG-050"]) }));
    expect(l.flags).toContain("WEAK_MATCH");
    expect(l.confidence).toBe("LOW");
  });

  it("caps at Low when the model's 'original words' aren't in the message", () => {
    const [l] = run("2 peti washing powder 1 kilo", [line("2 peti detergent powder 1 kilo", "SKU-DT-1KG", 2, 99)], ctx({ pastSkuIds: R0001_HISTORY }));
    expect(l.flags).toContain("NOT_IN_MESSAGE");
    expect(l.confidence).toBe("LOW");
  });

  it("an approved retailer alias gives High only with a valid case quantity", () => {
    const aliases = new Map([["parle", "SKU-BS-075"]]);
    const ok = run("5 peti parle", [line("5 peti parle", null, 5, 10)], ctx({ aliases }));
    expect(ok[0]).toMatchObject({ suggestedSkuId: "SKU-BS-075", confidence: "HIGH", suggestedCases: 5 });
    expect(ok[0].flags).toContain("ALIAS");
    const pieces = run("5 packet parle", [{ ...line("5 packet parle", null, 5, 10), unit: "PIECE" }], ctx({ aliases }));
    expect(pieces[0].confidence).toBe("NEEDS_CLARIFICATION");
  });
});

describe("units and quantities (D3)", () => {
  it("pieces are flagged and never converted to cases", () => {
    const [l] = run("20 packet biscuit chhota", [{ ...line("20 packet biscuit chhota", "SKU-BS-075", 20, 95), unit: "PIECE" }], ctx({ pastSkuIds: R0001_HISTORY }));
    expect(l).toMatchObject({ confidence: "NEEDS_CLARIFICATION", suggestedCases: null });
    expect(l.flags).toContain("PIECES");
  });

  it("no unit word means ask, even if the model claims cases", () => {
    const [l] = run("5 biscuit chhota", [line("5 biscuit chhota", "SKU-BS-075", 5, 99)], ctx({ pastSkuIds: R0001_HISTORY }));
    expect(l).toMatchObject({ confidence: "NEEDS_CLARIFICATION", suggestedCases: null });
    expect(l.flags).toContain("UNIT_UNCLEAR");
  });

  it("a quantity not in the words, or out of range, is unclear", () => {
    const [invented] = run("peti biscuit chhota", [line("peti biscuit chhota", "SKU-BS-075", 5, 99)], ctx({ pastSkuIds: R0001_HISTORY }));
    expect(invented.flags).toContain("QTY_UNCLEAR");
    const [huge] = run("5000 peti biscuit chhota", [line("5000 peti biscuit chhota", "SKU-BS-075", 5000, 99)], ctx({ pastSkuIds: R0001_HISTORY }));
    expect(huge).toMatchObject({ confidence: "NEEDS_CLARIFICATION", suggestedCases: null });
  });

  it("does not mistake a pack size for the quantity", () => {
    const [l] = run("chai patti 250 wala peti", [line("chai patti 250 wala peti", "SKU-TE-250", 250, 99)], ctx({ pastSkuIds: R0001_HISTORY }));
    expect(l.flags).toContain("QTY_UNCLEAR");
  });
});

describe("never trusting the model (CLAUDE.md, D94)", () => {
  it("an invented, unknown or inactive short ID becomes unmatched with the words kept", () => {
    const [l] = run("3 peti sabun", [{ raw: "3 peti sabun", sku: "S999", qty: 3, unit: "CASE", score: 99, alternatives: ["S998"] }]);
    expect(l).toMatchObject({ suggestedSkuId: null, aiSkuId: null, confidence: "LOW", raw: "3 peti sabun" });
    expect(l.flags).toContain("UNMATCHED");
  });

  it("keeps the model's own pick separate from the suggestion when an alias overrides it", () => {
    const [l] = run("5 peti parle", [line("5 peti parle", "SKU-CR-100", 5, 50)], ctx({ aliases: new Map([["parle", "SKU-BS-075"]]) }));
    expect(l).toMatchObject({ aiSkuId: "SKU-CR-100", suggestedSkuId: "SKU-BS-075" });
  });

  it("drops invalid, duplicate and self alternatives, then fills to two", () => {
    const [l] = run("2 peti washing powder 1 kilo", [line("2 peti washing powder 1 kilo", "SKU-DT-1KG", 2, 90, ["SKU-DT-1KG", "SKU-DT-500", "SKU-DT-500"])]);
    expect(l.alternativeSkuIds).toHaveLength(2);
    expect(l.alternativeSkuIds).not.toContain("SKU-DT-1KG");
    expect(new Set(l.alternativeSkuIds).size).toBe(2);
  });

  it("clamps silly scores and strips control characters from the words", () => {
    const [l] = run("2 peti washing powder 1 kilo", [{ ...line("2 peti washing\u0000 powder 1 kilo", "SKU-DT-1KG", 2, 9999) }]);
    expect(l.aiScore).toBe(100);
    expect(l.raw).not.toMatch(/\u0000/);
  });

  it("keeps the model's 'unmatched' words as lines to resolve, never dropping them", () => {
    const lines = run("2 peti washing powder 1 kilo, ek peti xyz", [line("2 peti washing powder 1 kilo", "SKU-DT-1KG", 2, 95)], ctx(), ["ek peti xyz"]);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({ raw: "ek peti xyz", suggestedSkuId: null, confidence: "LOW" });
  });

  it("flags the same product on two lines", () => {
    const lines = run("2 peti washing powder 1 kilo aur 3 peti washing powder 1 kilo", [
      line("2 peti washing powder 1 kilo", "SKU-DT-1KG", 2, 95),
      line("3 peti washing powder 1 kilo", "SKU-DT-1KG", 3, 95),
    ]);
    for (const l of lines) expect(l.flags).toContain("DUPLICATE");
  });

  it("returns at most 30 lines", () => {
    const many = Array.from({ length: 40 }, () => line("2 peti washing powder 1 kilo", "SKU-DT-1KG", 2, 95));
    expect(run("2 peti washing powder 1 kilo", many, ctx(), ["x", "y"])).toHaveLength(30);
  });
});

describe("Hindi and English messages", () => {
  it("Hindi: 'तीन पेटी डिटर्जेंट पाउडर 1 किलो'", () => {
    const [l] = run("तीन पेटी डिटर्जेंट पाउडर 1 किलो", [line("तीन पेटी डिटर्जेंट पाउडर 1 किलो", "SKU-DT-1KG", 3, 90)], ctx({ pastSkuIds: R0001_HISTORY }));
    expect(l).toMatchObject({ suggestedSkuId: "SKU-DT-1KG", suggestedCases: 3, confidence: "HIGH" });
  });

  it("English: '4 cases of turmeric powder 100 g'", () => {
    const [l] = run("4 cases of turmeric powder 100 g", [line("4 cases of turmeric powder 100 g", "SKU-HL-100", 4, 85)], ctx({ pastSkuIds: new Set(["SKU-HL-100"]) }));
    expect(l).toMatchObject({ suggestedSkuId: "SKU-HL-100", suggestedCases: 4, confidence: "HIGH" });
  });
});

describe("aliasKey (D28)", () => {
  it("drops quantities, case words and filler but keeps pack numbers and size words", async () => {
    const { aliasKey } = await import("./text");
    expect(aliasKey("bhaiya 5 peti biscuit chhota")).toBe("biscuit chhota");
    expect(aliasKey("2 peti washing powder 1 kilo")).toBe("washing powder 1 kilo");
    expect(aliasKey("chai patti 250 wala 1 peti")).toBe("chai patti 250"); // "wala" is filler; the pack number stays
    expect(aliasKey("biscuit bada 3 peti")).not.toBe(aliasKey("biscuit chhota 3 peti"));
    expect(aliasKey("5 peti")).toBe("");
  });
});
