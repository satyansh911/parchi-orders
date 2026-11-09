import { describe, expect, it } from "vitest";
import { cardOffer, freeProgress } from "./card-offer";

const slab = { type: "SLAB_DISCOUNT" as const, buyCases: null, freeCases: null, minCases: 5, discountBps: 300 };
const free = { type: "FREE_GOODS" as const, buyCases: 10, freeCases: 1, minCases: null, discountBps: null };

describe("card offer (display, D2 best offer)", () => {
  it("shows the slab discount from the threshold: detergent ₹2,030 → ₹1,969.10 per case", () => {
    expect(cardOffer(203_000, 4, [slab])).toEqual({ kind: "NONE" });
    expect(cardOffer(203_000, 5, [slab])).toEqual({ kind: "DISCOUNT", discountBps: 300, casePricePaise: 196_910, savedPaise: 30_450 });
  });

  it("shows free cases per complete multiple", () => {
    expect(cardOffer(77_760, 9, [free])).toEqual({ kind: "NONE" });
    expect(cardOffer(77_760, 21, [free])).toEqual({ kind: "FREE", freeCases: 2, freeValuePaise: 155_520 });
  });

  it("never stacks: the bigger saving wins, a tie goes to the discount", () => {
    expect(cardOffer(100_000, 10, [slab, free])).toMatchObject({ kind: "FREE" }); // 1 case free (₹1,000) beats 3% (₹300)
    const tenPct = { ...slab, discountBps: 1000 };
    expect(cardOffer(100_000, 10, [tenPct, free])).toMatchObject({ kind: "DISCOUNT" }); // ₹1,000 = ₹1,000
  });

  it("tracks progress to the next free case", () => {
    expect(freeProgress(7, [free])).toEqual({ have: 7, need: 10, freeCases: 1 });
    expect(freeProgress(0, [free])).toBeNull();
    expect(freeProgress(5, [slab])).toBeNull();
  });
});
