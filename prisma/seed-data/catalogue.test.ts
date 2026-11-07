import { describe, expect, it } from "vitest";
import { BRANDS, BRIEF_SKU_CODES, CATEGORIES, DEMO_GST_BPS, SCHEMES, SKUS } from "./catalogue";

const sku = (code: string) => {
  const found = SKUS.find((s) => s.code === code);
  if (!found) throw new Error(`missing ${code}`);
  return found;
};
const schemesFor = (code: string) => SCHEMES.filter((s) => s.skuCode === code);

describe("seed catalogue: brief sample data is exact", () => {
  it("glucose biscuit 75 g: case of 96, ₹8.10, 340 cases, buy 10 get 1", () => {
    expect(sku("SKU-BS-075")).toMatchObject({
      nameEn: "Glucose biscuit 75 g", piecesPerCase: 96, dealerPricePaise: 810, stockCases: 340,
    });
    expect(schemesFor("SKU-BS-075")).toEqual([
      expect.objectContaining({ type: "FREE_GOODS", buyCases: 10, freeCases: 1 }),
    ]);
  });

  it("detergent powder 1 kg: case of 20, ₹101.50, 85 cases, 3% off 5+", () => {
    expect(sku("SKU-DT-1KG")).toMatchObject({
      nameEn: "Detergent powder 1 kg", piecesPerCase: 20, dealerPricePaise: 10150, stockCases: 85,
    });
    expect(schemesFor("SKU-DT-1KG")).toEqual([
      expect.objectContaining({ type: "SLAB_DISCOUNT", minCases: 5, discountBps: 300 }),
    ]);
  });

  it("tea leaf 250 g: case of 40, ₹118.00, out of stock, no scheme", () => {
    expect(sku("SKU-TE-250")).toMatchObject({
      nameEn: "Tea leaf 250 g", piecesPerCase: 40, dealerPricePaise: 11800, stockCases: 0,
    });
    expect(schemesFor("SKU-TE-250")).toEqual([]);
  });
});

describe("seed catalogue: shape", () => {
  it("has the 3 brief SKUs plus about 35 more, with unique codes", () => {
    expect(new Set(SKUS.map((s) => s.code)).size).toBe(SKUS.length);
    expect(SKUS.length - BRIEF_SKU_CODES.length).toBeGreaterThanOrEqual(33);
  });

  it("uses all 4 fictional brands and every category", () => {
    expect(new Set(SKUS.map((s) => s.brand))).toEqual(new Set(BRANDS));
    expect(new Set(SKUS.map((s) => s.category))).toEqual(new Set(CATEGORIES.map((c) => c.slug)));
  });

  it("gives every SKU a Hindi name in Devanagari", () => {
    for (const s of SKUS) expect(s.nameHi, s.code).toMatch(/[ऀ-ॿ]/);
  });

  it("uses positive integer paise and whole cases", () => {
    for (const s of SKUS) {
      expect(Number.isInteger(s.dealerPricePaise) && s.dealerPricePaise > 0, s.code).toBe(true);
      expect(Number.isInteger(s.mrpPaise) && s.mrpPaise > 0, s.code).toBe(true);
      expect(Number.isInteger(s.piecesPerCase) && s.piecesPerCase > 0, s.code).toBe(true);
      expect(Number.isInteger(s.stockCases) && s.stockCases >= 0, s.code).toBe(true);
    }
  });

  it("applies the approved demo GST rates (D35)", () => {
    expect(DEMO_GST_BPS.biscuits).toBe(500);
    expect(DEMO_GST_BPS.tea).toBe(500);
    expect(DEMO_GST_BPS.detergent).toBe(1800);
  });
});

describe("seed catalogue: schemes", () => {
  it("only reference existing SKUs", () => {
    const codes = new Set(SKUS.map((s) => s.code));
    for (const s of SCHEMES) expect(codes.has(s.skuCode), s.skuCode).toBe(true);
  });

  it("have valid numbers for their type", () => {
    for (const s of SCHEMES) {
      if (s.type === "FREE_GOODS") {
        expect(s.buyCases).toBeGreaterThan(0);
        expect(s.freeCases).toBeGreaterThan(0);
      } else {
        expect(s.minCases).toBeGreaterThan(0);
        expect(s.discountBps).toBeGreaterThan(0);
        expect(s.discountBps).toBeLessThanOrEqual(10000);
      }
    }
  });

  it("include a dual-scheme SKU whose stock can't cover free goods at full stock (D18 demo)", () => {
    const dual = SKUS.filter((s) => new Set(schemesFor(s.code).map((x) => x.type)).size === 2);
    expect(dual.length).toBeGreaterThanOrEqual(1);
    const demo = dual.find((s) => {
      const fg = schemesFor(s.code).find((x) => x.type === "FREE_GOODS");
      return fg?.type === "FREE_GOODS" &&
        s.stockCases + Math.floor(s.stockCases / fg.buyCases) * fg.freeCases > s.stockCases;
    });
    expect(demo).toBeDefined();
  });
});
