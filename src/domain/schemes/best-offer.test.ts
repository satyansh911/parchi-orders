import { describe, expect, it } from "vitest";
import { selectBestOffer } from "./best-offer";
import { NOW, freeGoods, slab } from "./fixtures.test-helpers";

const CREAM_STD = 145_800; // cream biscuit 100 g, 60 x ₹24.30
const DT2KG_STD = 198_000; // detergent 2 kg, 10 x ₹198

const best = (schemes: Parameters<typeof selectBestOffer>[0]["schemes"], paidCases: number, casePricePaise: number, now = NOW) =>
  selectBestOffer({ schemes, paidCases, casePricePaise, now });

describe("selectBestOffer: one scheme per line, highest benefit to the retailer (D2)", () => {
  const cream = [freeGoods(10, 1), slab(5, 300)];

  it("applies nothing when no scheme is eligible", () => {
    expect(best(cream, 4, CREAM_STD)).toEqual({ applied: null, otherOffer: null });
    expect(best([], 50, CREAM_STD)).toEqual({ applied: null, otherOffer: null });
  });

  it("uses the slab between 5 and 9 cases, where free goods aren't reached", () => {
    const r = best(cream, 9, CREAM_STD);
    expect(r.applied).toMatchObject({ type: "SLAB_DISCOUNT", discountPaise: 39_366, freeCases: 0 });
    expect(r.otherOffer).toBeNull();
  });

  it("at 10 cases picks free goods (₹1,458 value) over 3% off (₹437.40) and names the other offer", () => {
    const r = best(cream, 10, CREAM_STD);
    expect(r.applied).toMatchObject({ type: "FREE_GOODS", freeCases: 1, benefitPaise: 145_800, discountPaise: 0 });
    expect(r.otherOffer).toMatchObject({ type: "SLAB_DISCOUNT", benefitPaise: 43_740, labelEn: "3% off on 5 or more cases" });
  });

  it("never stacks: exactly one applied scheme, the other carries no benefit into the line", () => {
    const r = best(cream, 30, CREAM_STD);
    expect(r.applied?.type).toBe("FREE_GOODS");
    expect(r.applied?.discountPaise).toBe(0);
    expect(r.applied?.freeCases).toBe(3);
  });

  it("on an exact tie prefers the discount, because it doesn't consume stock (D2)", () => {
    // Free value = 1 case = 100,000. Discount = 10% of 10 x 100,000 = 100,000.
    const r = best([freeGoods(10, 1), slab(10, 1000)], 10, 100_000);
    expect(r.applied).toMatchObject({ type: "SLAB_DISCOUNT", benefitPaise: 100_000 });
    expect(r.otherOffer).toMatchObject({ type: "FREE_GOODS", benefitPaise: 100_000 });
  });

  it("picks free goods when they beat the discount by a single paisa", () => {
    // Free value 1,000; discount 9.99% of 10,000 = 999.
    const r = best([freeGoods(10, 1), slab(10, 999)], 10, 1_000);
    expect(r.applied).toMatchObject({ type: "FREE_GOODS", benefitPaise: 1_000 });
  });

  it("chooses the better of two free-goods schemes", () => {
    const schemes = [freeGoods(10, 1), freeGoods(25, 3)];
    expect(best(schemes, 25, CREAM_STD).applied).toMatchObject({ id: "fg-25-3", freeCases: 3 });
    expect(best(schemes, 20, CREAM_STD).applied).toMatchObject({ id: "fg-10-1", freeCases: 2 });
  });

  it("treats a two-step slab as two schemes and applies the higher step", () => {
    const schemes = [slab(5, 300), slab(10, 500)];
    expect(best(schemes, 9, DT2KG_STD).applied).toMatchObject({ discountBps: 300, discountPaise: 53_460 });
    expect(best(schemes, 10, DT2KG_STD).applied).toMatchObject({ discountBps: 500, discountPaise: 99_000 });
  });

  it("names the runner-up only when it is a different offer type (D46)", () => {
    expect(best([slab(5, 300), slab(10, 500)], 10, DT2KG_STD).otherOffer).toBeNull();
  });

  it("ignores inactive, expired and not-yet-started schemes", () => {
    const off = slab(5, 300, { id: "off", active: false });
    const expired = slab(5, 300, { id: "expired", endsAt: new Date("2026-10-31T18:30:00Z") });
    const future = slab(5, 300, { id: "future", startsAt: new Date("2026-12-01T00:00:00Z") });
    expect(best([off, expired, future], 20, DT2KG_STD).applied).toBeNull();
  });

  it("can leave free goods out, for the 'without free goods' stock option (D18, D42)", () => {
    const r = selectBestOffer({ schemes: cream, paidCases: 10, casePricePaise: CREAM_STD, now: NOW, excludeFreeGoods: true });
    expect(r.applied).toMatchObject({ type: "SLAB_DISCOUNT", discountPaise: 43_740 });
    expect(r.otherOffer).toBeNull();
    const biscuitOnly = selectBestOffer({ schemes: [freeGoods(10, 1)], paidCases: 335, casePricePaise: 77_760, now: NOW, excludeFreeGoods: true });
    expect(biscuitOnly.applied).toBeNull();
  });

  it("gives the same answer whatever order the schemes come in", () => {
    const a = best([freeGoods(10, 1), slab(10, 1000)], 10, 100_000);
    const b = best([slab(10, 1000), freeGoods(10, 1)], 10, 100_000);
    expect(a).toEqual(b);
  });
});
