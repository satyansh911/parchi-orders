import { describe, expect, it } from "vitest";
import { DomainError } from "../errors";
import { BISCUIT_75G, CREAM_100G, DETERGENT_1KG, KEY_ACCOUNT, STANDARD, perCase } from "./fixtures.test-helpers";
import { priceLine } from "./price-line";

describe("priceLine: discount first, then GST on the discounted value (A.4, D6)", () => {
  it("detergent 1 kg, 5 cases: 3% off the whole line, then 18% GST", () => {
    const line = priceLine({ sku: DETERGENT_1KG, paidCases: 5 }, STANDARD);
    expect(line).toMatchObject({
      casePricePaise: 203_000,
      taxablePaise: 1_015_000,
      discountBps: 300,
      discountPaise: 30_450,
      gstBps: 1800,
      gstPaise: 177_219, // 18% of 984,550
      lineTotalPaise: 1_161_769,
      freeCases: 0,
    });
    expect(line.gstPaise).not.toBe(182_700); // not 18% of the pre-discount value
  });

  it("rounds GST half-up per line", () => {
    const line = priceLine({ sku: perCase("SYN-GST", 2_775, 1800), paidCases: 1 }, STANDARD);
    expect(line.gstPaise).toBe(500); // 499.5
  });

  it("free goods carry no taxable value and no GST; their value is reported separately (D6, C.22)", () => {
    expect(priceLine({ sku: BISCUIT_75G, paidCases: 10 }, STANDARD)).toMatchObject({
      taxablePaise: 777_600,
      discountPaise: 0,
      gstPaise: 38_880,
      lineTotalPaise: 816_480,
      freeCases: 1,
      freeValuePaise: 77_760,
    });
  });

  it("uses the retailer's tier price throughout (D5)", () => {
    expect(priceLine({ sku: BISCUIT_75G, paidCases: 10 }, KEY_ACCOUNT)).toMatchObject({
      casePricePaise: 76_205,
      taxablePaise: 762_050,
      gstPaise: 38_103, // 38,102.5
      lineTotalPaise: 800_153,
      freeValuePaise: 76_205,
    });
  });

  it("records the applied offer and names a different-type runner-up (D2, D46)", () => {
    const line = priceLine({ sku: CREAM_100G, paidCases: 10 }, STANDARD);
    expect(line.applied).toMatchObject({ type: "FREE_GOODS", freeCases: 1 });
    expect(line.otherOffer).toMatchObject({ type: "SLAB_DISCOUNT" });
    expect(line).toMatchObject({ taxablePaise: 1_458_000, discountPaise: 0, gstPaise: 72_900, lineTotalPaise: 1_530_900 });
  });

  it("has no offer when none is eligible", () => {
    const line = priceLine({ sku: DETERGENT_1KG, paidCases: 2 }, STANDARD);
    expect(line).toMatchObject({ applied: null, otherOffer: null, discountPaise: 0, lineTotalPaise: 479_080 });
  });

  it("can price the line without free goods when asked (stock option, D42)", () => {
    const line = priceLine({ sku: BISCUIT_75G, paidCases: 335 }, STANDARD, { excludeFreeGoods: true });
    expect(line).toMatchObject({ freeCases: 0, applied: null, taxablePaise: 335 * 77_760 });
  });
});

describe("priceLine: invalid input", () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 1000])("rejects %s paid cases", (paidCases) => {
    expect(() => priceLine({ sku: DETERGENT_1KG, paidCases }, STANDARD)).toThrow(
      expect.objectContaining({ code: "INVALID_QUANTITY" }),
    );
  });

  it("accepts the 999-case maximum per line (D45)", () => {
    expect(priceLine({ sku: DETERGENT_1KG, paidCases: 999 }, STANDARD).paidCases).toBe(999);
  });

  it("rejects an inactive SKU", () => {
    expect(() => priceLine({ sku: { ...DETERGENT_1KG, active: false }, paidCases: 1 }, STANDARD)).toThrow(
      expect.objectContaining({ code: "SKU_INACTIVE" }),
    );
  });

  it("rejects an invalid GST rate", () => {
    expect(() => priceLine({ sku: { ...DETERGENT_1KG, gstBps: 10_001 }, paidCases: 1 }, STANDARD)).toThrow(DomainError);
  });
});
