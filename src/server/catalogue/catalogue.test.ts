import { describe, expect, it } from "vitest";
import { toCatalogueItem } from "./catalogue";

const NOW = new Date("2026-11-09T06:00:00Z");
const scheme = (fields: Record<string, unknown>) => ({
  id: "s1", skuId: "sku1", type: "FREE_GOODS" as const, labelEn: "Buy 10 cases get 1 free", labelHi: "10 पेटी पर 1 पेटी मुफ़्त",
  buyCases: 10, freeCases: 1, minCases: null, discountBps: null, startsAt: null, endsAt: null, active: true, ...fields,
});
const row = (fields: Record<string, unknown> = {}) => ({
  id: "sku1", code: "SKU-BS-075", nameEn: "Glucose biscuit 75 g", nameHi: "ग्लूकोज़ बिस्कुट 75 ग्राम",
  brandId: "b", categoryId: "c", packSize: "75 g", piecesPerCase: 96, dealerPricePaise: 810, dealerPriceUnit: "PIECE" as const,
  mrpPaise: 1000, gstBps: 500, stockCases: 340, reservedCases: 0, imageKey: "box", active: true,
  brand: { id: "b", name: "Rewa Foods" },
  category: { id: "c", slug: "biscuits", nameEn: "Biscuits", nameHi: "बिस्कुट", sortOrder: 1 },
  schemes: [scheme({})],
  ...fields,
});

describe("toCatalogueItem", () => {
  it("prices with the retailer's tier through the domain engine (D5, D6)", () => {
    expect(toCatalogueItem(row(), 0, NOW)).toMatchObject({ casePricePaise: 77_760, piecePricePaise: 810 });
    expect(toCatalogueItem(row(), 200, NOW)).toMatchObject({ casePricePaise: 76_205, piecePricePaise: 794 });
  });

  it("keeps MRP separate from the dealer price (A.2)", () => {
    const item = toCatalogueItem(row(), 0, NOW);
    expect(item.mrpPaise).toBe(1000);
    expect(item.mrpPaise).not.toBe(item.piecePricePaise);
  });

  it("never exposes raw stock, reserved stock or the base dealer price", () => {
    const json = JSON.stringify(toCatalogueItem(row(), 200, NOW));
    expect(json).not.toMatch(/stockCases|reservedCases|dealerPrice/);
    expect(json).not.toContain("340");
  });

  it("uses stock minus reserved for the band (D4, D26)", () => {
    expect(toCatalogueItem(row({ stockCases: 85, reservedCases: 70 }), 0, NOW).stock).toEqual({ status: "LOW", casesLeft: 15 });
    expect(toCatalogueItem(row({ stockCases: 0 }), 0, NOW).stock).toEqual({ status: "OUT" });
  });

  it("lists only offers active now (D43)", () => {
    const expired = scheme({ id: "s2", type: "SLAB_DISCOUNT", endsAt: new Date("2026-10-31T18:30:00Z") });
    const off = scheme({ id: "s3", active: false });
    expect(toCatalogueItem(row({ schemes: [scheme({}), expired, off] }), 0, NOW).offers.map((o) => o.id)).toEqual(["s1"]);
  });
});
