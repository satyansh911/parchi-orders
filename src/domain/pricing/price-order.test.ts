import { describe, expect, it } from "vitest";
import { BISCUIT_75G, DETERGENT_1KG, STANDARD, perCase } from "./fixtures.test-helpers";
import { MAX_LINES_PER_ORDER, MAX_ORDER_TOTAL_PAISE } from "./limits";
import { priceOrder } from "./price-order";

const code = (c: string) => expect.objectContaining({ code: c });

describe("priceOrder: totals are sums of rounded line values (D6)", () => {
  it("prices the brief's sample order (biscuit 5, detergent 2) at the Standard tier", () => {
    const order = priceOrder(
      [
        { sku: BISCUIT_75G, paidCases: 5 },
        { sku: DETERGENT_1KG, paidCases: 2 },
      ],
      STANDARD,
    );
    expect(order.lines.map((l) => l.lineTotalPaise)).toEqual([408_240, 479_080]);
    expect(order).toMatchObject({ taxablePaise: 794_800, discountPaise: 0, gstPaise: 92_520, totalPaise: 887_320 });
  });

  it("sums per-line GST, which can differ from rounding GST on the order total", () => {
    const order = priceOrder(
      [
        { sku: perCase("SYN-A", 2_775, 1800), paidCases: 1 },
        { sku: perCase("SYN-B", 2_775, 1800), paidCases: 1 },
      ],
      STANDARD,
    );
    expect(order.gstPaise).toBe(1_000); // 500 + 500; order-level rounding of 5,550 x 18% would give 999
  });
});

describe("priceOrder: validation (D45, D48)", () => {
  it("rejects an empty order", () => {
    expect(() => priceOrder([], STANDARD)).toThrow(code("EMPTY_ORDER"));
  });

  it("rejects the same SKU on two lines", () => {
    expect(() =>
      priceOrder([{ sku: BISCUIT_75G, paidCases: 5 }, { sku: BISCUIT_75G, paidCases: 6 }], STANDARD),
    ).toThrow(code("DUPLICATE_SKU"));
  });

  it("accepts 50 lines and rejects 51", () => {
    const lines = (n: number) => Array.from({ length: n }, (_, i) => ({ sku: perCase(`SYN-${i}`, 1_000, 0), paidCases: 1 }));
    expect(MAX_LINES_PER_ORDER).toBe(50);
    expect(priceOrder(lines(50), STANDARD).lines).toHaveLength(50);
    expect(() => priceOrder(lines(51), STANDARD)).toThrow(code("TOO_MANY_LINES"));
  });

  it("accepts exactly ₹1 crore and rejects one paisa more", () => {
    expect(MAX_ORDER_TOTAL_PAISE).toBe(1_000_000_000);
    const big = perCase("SYN-BIG", 1_000_000, 0); // ₹10,000 a case, no GST
    const atLimit = priceOrder([{ sku: big, paidCases: 999 }, { sku: perCase("SYN-1", 1_000_000, 0), paidCases: 1 }], STANDARD);
    expect(atLimit.totalPaise).toBe(1_000_000_000);
    expect(() =>
      priceOrder([{ sku: big, paidCases: 999 }, { sku: perCase("SYN-2", 1_000_001, 0), paidCases: 1 }], STANDARD),
    ).toThrow(code("ORDER_TOO_LARGE"));
  });
});
