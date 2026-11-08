import { describe, expect, it } from "vitest";
import { freeGoods, slab } from "../schemes/fixtures.test-helpers";
import { BISCUIT_75G, CREAM_100G, DETERGENT_1KG, STANDARD, TEA_250G } from "./fixtures.test-helpers";
import { nudgeFor } from "./nudge";
import type { CatalogueSku } from "./price-line";

const DT_2KG: CatalogueSku = { ...DETERGENT_1KG, id: "id-SKU-DT-2KG", code: "SKU-DT-2KG", dealerPricePaise: 19_800, piecesPerCase: 10, schemes: [slab(5, 300), slab(10, 500)] };

const nudge = (sku: CatalogueSku, paidCases: number, availableCases: number) => nudgeFor({ sku, paidCases, availableCases }, STANDARD);

describe("nudgeFor: at most one useful 'add N more' per line (D19, D44)", () => {
  it("biscuit at 7 cases: add 3 more for 1 free", () => {
    expect(nudge(BISCUIT_75G, 7, 340)).toMatchObject({ addCases: 3, targetPaidCases: 10, type: "FREE_GOODS", freeCases: 1, extraFreeCases: 1 });
  });

  it("biscuit at 10 cases: the next nudge is at 20, for one more free case", () => {
    expect(nudge(BISCUIT_75G, 10, 340)).toMatchObject({ addCases: 10, targetPaidCases: 20, freeCases: 2, extraFreeCases: 1 });
  });

  it("detergent 1 kg at 3 cases: add 2 more for 3% off", () => {
    expect(nudge(DETERGENT_1KG, 3, 85)).toMatchObject({ addCases: 2, type: "SLAB_DISCOUNT", discountBps: 300 });
  });

  it("no slab nudge once the slab already applies", () => {
    expect(nudge(DETERGENT_1KG, 5, 85)).toBeNull();
  });

  it("two-step slab at 7 cases: add 3 more for 5% off (beats the current 3%)", () => {
    expect(nudge(DT_2KG, 7, 55)).toMatchObject({ addCases: 3, discountBps: 500 });
  });

  it("shows only the nudge needing the fewest extra cases", () => {
    // Cream biscuit at 3: slab at 5 (+2) beats free goods at 10 (+7).
    expect(nudge(CREAM_100G, 3, 50)).toMatchObject({ addCases: 2, type: "SLAB_DISCOUNT" });
    // At 5 the slab applies; the next useful step is free goods at 10.
    expect(nudge(CREAM_100G, 5, 50)).toMatchObject({ addCases: 5, type: "FREE_GOODS", freeCases: 1 });
  });

  it("when two nudges need the same cases, shows the larger benefit (best offer at the target)", () => {
    const sku = { ...BISCUIT_75G, schemes: [freeGoods(10, 1), slab(10, 500)] };
    // At 10 cases: 1 free case (77,760) beats 5% off (38,880).
    expect(nudge(sku, 7, 340)).toMatchObject({ addCases: 3, type: "FREE_GOODS" });
  });

  it("no nudge if stock can't cover the target including its free cases", () => {
    expect(nudge(BISCUIT_75G, 335, 340)).toBeNull(); // 340 + 34 free > 340
    expect(nudge(CREAM_100G, 46, 50)).toBeNull(); // 50 + 5 free > 50
    expect(nudge(BISCUIT_75G, 7, 10)).toBeNull(); // 10 + 1 free > 10
  });

  it("no nudge beyond the 999-case line limit", () => {
    expect(nudge(BISCUIT_75G, 995, 5_000)).toBeNull();
  });

  it("no nudge without an active scheme", () => {
    expect(nudge(TEA_250G, 3, 100)).toBeNull();
    const expired = { ...DETERGENT_1KG, schemes: [slab(5, 300, { endsAt: new Date("2026-11-01T00:00:00Z") })] };
    expect(nudge(expired, 3, 85)).toBeNull();
  });

  it("no nudge when the current line doesn't fit in stock", () => {
    expect(nudge(BISCUIT_75G, 7, 0)).toBeNull();
  });
});
