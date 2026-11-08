import { describe, expect, it } from "vitest";
import { BISCUIT_75G, CREAM_100G, DETERGENT_1KG, STANDARD, TEA_250G } from "../pricing/fixtures.test-helpers";
import type { CatalogueSku } from "../pricing/price-line";
import { freeGoods } from "../schemes/fixtures.test-helpers";
import { availableCases, evaluateLineStock, type LineStockResult } from "./line-stock";

const TEA_500G: CatalogueSku = { ...TEA_250G, id: "id-SKU-TE-500", code: "SKU-TE-500", dealerPricePaise: 23_200, piecesPerCase: 24, schemes: [freeGoods(20, 1)] };

const evaluate = (sku: CatalogueSku, requestedCases: number, available: number, choice?: "BEST" | "WITHOUT_FREE_GOODS") =>
  evaluateLineStock({ sku, requestedCases, availableCases: available, choice }, STANDARD);

const options = (r: LineStockResult) => {
  if (r.status !== "STOCK_SHORT") throw new Error(`expected STOCK_SHORT, got ${r.status}`);
  return r.options.map((o) => ({ kind: o.kind, paid: o.line.paidCases, free: o.line.freeCases, discountBps: o.line.discountBps }));
};

describe("availableCases (D4)", () => {
  it("is stock minus reserved", () => {
    expect(availableCases(85, 80)).toBe(5);
    expect(availableCases(340, 0)).toBe(340);
  });

  it("rejects inconsistent stock figures", () => {
    expect(() => availableCases(5, 6)).toThrow();
    expect(() => availableCases(-1, 0)).toThrow();
    expect(() => availableCases(5, 1.5)).toThrow();
  });
});

describe("evaluateLineStock: enough stock", () => {
  it("accepts the line with the best offer when paid + free fit", () => {
    const r = evaluate(BISCUIT_75G, 10, 11);
    expect(r).toMatchObject({ status: "OK", selection: "BEST_OFFER", line: { paidCases: 10, freeCases: 1 } });
  });

  it("accepts stock exactly equal to paid + free", () => {
    expect(evaluate(BISCUIT_75G, 309, 339).status).toBe("OK");
  });
});

describe("evaluateLineStock: out of stock (A.5)", () => {
  it("returns OUT_OF_STOCK with no options when nothing is available", () => {
    expect(evaluate(TEA_250G, 1, 0)).toEqual({ status: "OUT_OF_STOCK" });
  });
});

describe("evaluateLineStock: free goods don't fit (D7, D18, D42)", () => {
  it("biscuit, 340 available, asks 335: 309 + 30 free, or 335 without free goods (D42)", () => {
    const r = evaluate(BISCUIT_75G, 335, 340);
    expect(r).toMatchObject({ status: "STOCK_SHORT", reason: "FREE_GOODS_DONT_FIT" });
    expect(options(r)).toEqual([
      { kind: "WITH_FREE_GOODS", paid: 309, free: 30, discountBps: 0 },
      { kind: "WITHOUT_FREE_GOODS", paid: 335, free: 0, discountBps: 0 },
    ]);
  });

  it("biscuit, asks 400 of 340: 309 + 30 free (310 would need 341), or 340 without free goods", () => {
    const r = evaluate(BISCUIT_75G, 400, 340);
    expect(r).toMatchObject({ status: "STOCK_SHORT", reason: "MORE_THAN_AVAILABLE" });
    expect(options(r)).toEqual([
      { kind: "WITH_FREE_GOODS", paid: 309, free: 30, discountBps: 0 },
      { kind: "WITHOUT_FREE_GOODS", paid: 340, free: 0, discountBps: 0 },
    ]);
  });

  it("biscuit, 21 available, asks 21: 19 + 1 free, or 21 without", () => {
    expect(options(evaluate(BISCUIT_75G, 21, 21))).toEqual([
      { kind: "WITH_FREE_GOODS", paid: 19, free: 1, discountBps: 0 },
      { kind: "WITHOUT_FREE_GOODS", paid: 21, free: 0, discountBps: 0 },
    ]);
  });

  it("biscuit, 10 available, asks 10: only '10 without free goods' (9 with no free goods is never better)", () => {
    expect(options(evaluate(BISCUIT_75G, 10, 10))).toEqual([{ kind: "WITHOUT_FREE_GOODS", paid: 10, free: 0, discountBps: 0 }]);
  });

  it("tea 500 g buy 20 get 1, 75 available: 72 + 3 free, or 75 without", () => {
    expect(options(evaluate(TEA_500G, 75, 75))).toEqual([
      { kind: "WITH_FREE_GOODS", paid: 72, free: 3, discountBps: 0 },
      { kind: "WITHOUT_FREE_GOODS", paid: 75, free: 0, discountBps: 0 },
    ]);
  });

  it("cream biscuit (two schemes), asks 50 of 50: 46 + 4 free, or 50 with 3% off (D18)", () => {
    expect(options(evaluate(CREAM_100G, 50, 50))).toEqual([
      { kind: "WITH_FREE_GOODS", paid: 46, free: 4, discountBps: 0 },
      { kind: "WITHOUT_FREE_GOODS", paid: 50, free: 0, discountBps: 300 },
    ]);
  });

  it("cream biscuit, asks 60 of 50: the same two options", () => {
    const r = evaluate(CREAM_100G, 60, 50);
    expect(r).toMatchObject({ reason: "MORE_THAN_AVAILABLE" });
    expect(options(r).map((o) => [o.paid, o.free])).toEqual([[46, 4], [50, 0]]);
  });

  it("never changes the requested quantity itself: options are offers, not the line", () => {
    expect(evaluate(BISCUIT_75G, 335, 340)).not.toHaveProperty("line");
  });
});

describe("evaluateLineStock: more than available, no free goods involved", () => {
  it("detergent 1 kg asks 90 of 85: one option, 85 with 3% off", () => {
    expect(options(evaluate(DETERGENT_1KG, 90, 85))).toEqual([{ kind: "MAX_AVAILABLE", paid: 85, free: 0, discountBps: 300 }]);
  });

  it("uses available = stock - reserved", () => {
    expect(options(evaluate(DETERGENT_1KG, 10, availableCases(85, 80)))).toEqual([
      { kind: "MAX_AVAILABLE", paid: 5, free: 0, discountBps: 300 },
    ]);
  });
});

describe("evaluateLineStock: the retailer's 'without free goods' choice (D34, D42, D47)", () => {
  it("accepts it when the free goods really don't fit", () => {
    const r = evaluate(BISCUIT_75G, 335, 340, "WITHOUT_FREE_GOODS");
    expect(r).toMatchObject({ status: "OK", selection: "WITHOUT_FREE_GOODS_STOCK_SHORT", line: { paidCases: 335, freeCases: 0 } });
  });

  it("returns OFFER_CHANGED with the current best line when the free goods fit (bypass attempt or stock came back)", () => {
    const r = evaluate(BISCUIT_75G, 335, 400, "WITHOUT_FREE_GOODS");
    expect(r).toMatchObject({ status: "OFFER_CHANGED", current: { status: "OK", line: { paidCases: 335, freeCases: 33 } } });
  });

  it("returns OFFER_CHANGED for a SKU whose offer involves no free goods", () => {
    expect(evaluate(DETERGENT_1KG, 5, 85, "WITHOUT_FREE_GOODS").status).toBe("OFFER_CHANGED");
  });

  it("does not accept the choice for more cases than are available", () => {
    expect(evaluate(BISCUIT_75G, 400, 340, "WITHOUT_FREE_GOODS").status).toBe("STOCK_SHORT");
  });
});

describe("evaluateLineStock: invalid input", () => {
  it("rejects invalid requested quantities", () => {
    for (const bad of [0, -1, 1.5, 1000]) {
      expect(() => evaluate(BISCUIT_75G, bad, 340)).toThrow(expect.objectContaining({ code: "INVALID_QUANTITY" }));
    }
  });

  it("rejects an invalid available figure", () => {
    expect(() => evaluate(BISCUIT_75G, 5, -1)).toThrow();
    expect(() => evaluate(BISCUIT_75G, 5, 2.5)).toThrow();
  });
});
