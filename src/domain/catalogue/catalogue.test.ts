import { describe, expect, it } from "vitest";
import { matchesQuery, normaliseQuery, type Searchable } from "./search";
import { LOW_STOCK_THRESHOLD, stockBand } from "./stock-band";

describe("stockBand (D26)", () => {
  it("is out of stock at 0 (and for nonsense values)", () => {
    expect(stockBand(0)).toEqual({ status: "OUT" });
    expect(stockBand(-3)).toEqual({ status: "OUT" });
    expect(stockBand(Number.NaN)).toEqual({ status: "OUT" });
  });

  it("shows the exact count only at 20 or fewer", () => {
    expect(LOW_STOCK_THRESHOLD).toBe(20);
    expect(stockBand(1)).toEqual({ status: "LOW", casesLeft: 1 });
    expect(stockBand(20)).toEqual({ status: "LOW", casesLeft: 20 });
  });

  it("never exposes a number above 20", () => {
    for (const n of [21, 85, 340, 10_000]) expect(stockBand(n)).toEqual({ status: "IN_STOCK" });
  });
});

const item = (fields: Partial<Searchable>): Searchable => ({
  code: "SKU-X", nameEn: "", nameHi: "", brand: "", categoryEn: "", categoryHi: "", packSize: "", ...fields,
});
const tea = item({ code: "SKU-TE-250", nameEn: "Tea leaf 250 g", nameHi: "चाय पत्ती 250 ग्राम", brand: "Kanha Chai", categoryEn: "Tea", categoryHi: "चाय", packSize: "250 g" });
const teaDust = item({ code: "SKU-TD-250", nameEn: "Tea dust 250 g", nameHi: "चाय डस्ट 250 ग्राम", brand: "Kanha Chai", categoryEn: "Tea", categoryHi: "चाय", packSize: "250 g" });
const detergent = item({ code: "SKU-DT-1KG", nameEn: "Detergent powder 1 kg", nameHi: "डिटर्जेंट पाउडर 1 किलो", brand: "Sitara Home Care", categoryEn: "Detergent", categoryHi: "डिटर्जेंट", packSize: "1 kg" });
const biscuit = item({ code: "SKU-BS-075", nameEn: "Glucose biscuit 75 g", nameHi: "ग्लूकोज़ बिस्कुट 75 ग्राम", brand: "Rewa Foods", categoryEn: "Biscuits", categoryHi: "बिस्कुट", packSize: "75 g" });

describe("matchesQuery (D82)", () => {
  it("matches English and Hindi names, case-insensitively", () => {
    expect(matchesQuery(biscuit, "GLUCOSE")).toBe(true);
    expect(matchesQuery(biscuit, "बिस्कुट")).toBe(true);
    expect(matchesQuery(tea, "चाय पत्ती")).toBe(true);
  });

  it("matches brand, category and code", () => {
    expect(matchesQuery(detergent, "sitara")).toBe(true);
    expect(matchesQuery(tea, "tea")).toBe(true);
    expect(matchesQuery(biscuit, "sku-bs")).toBe(true);
  });

  it("understands shop words from the glossary", () => {
    expect(matchesQuery(tea, "chai patti 250 wala")).toBe(true);
    expect(matchesQuery(teaDust, "chai patti")).toBe(false); // "patti" means leaf, not dust
    expect(matchesQuery(detergent, "washing powder 1 kilo")).toBe(true);
    expect(matchesQuery(biscuit, "biskut")).toBe(true);
  });

  it("matches Hindi whichever way the keyboard encodes a nukta (ज़ precomposed or ज + ़)", () => {
    const decomposed = item({ nameHi: "ग्लूकोज़ बिस्कुट" }); // how the seed stores it
    expect(matchesQuery(decomposed, "ग्लूकोज़")).toBe(true); // precomposed U+095B typed by some keyboards
    expect(matchesQuery(decomposed, "ग्लूकोज़")).toBe(true);
  });

  it("requires every word to match", () => {
    expect(matchesQuery(tea, "tea 500")).toBe(false);
    expect(matchesQuery(biscuit, "glucose detergent")).toBe(false);
  });

  it("treats an empty or filler-only query as matching everything", () => {
    expect(matchesQuery(tea, "")).toBe(true);
    expect(matchesQuery(tea, "   ")).toBe(true);
    expect(normaliseQuery("peti wala")).toEqual([]);
  });
});
