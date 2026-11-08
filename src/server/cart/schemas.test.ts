import { describe, expect, it } from "vitest";
import { cartLinesSchema } from "./schemas";

describe("cart line input (D45, D48, D69.4)", () => {
  it("accepts valid lines", () => {
    expect(cartLinesSchema.safeParse([{ skuId: "a", paidCases: 1 }, { skuId: "b", paidCases: 999, choice: "WITHOUT_FREE_GOODS" }]).success).toBe(true);
  });

  it.each([
    ["a duplicate SKU", [{ skuId: "a", paidCases: 1 }, { skuId: "a", paidCases: 2 }]],
    ["0 cases", [{ skuId: "a", paidCases: 0 }]],
    ["1000 cases", [{ skuId: "a", paidCases: 1000 }]],
    ["fractional cases", [{ skuId: "a", paidCases: 1.5 }]],
    ["an unknown choice", [{ skuId: "a", paidCases: 1, choice: "FREE" }]],
    ["a retailerId on a line", [{ skuId: "a", paidCases: 1, retailerId: "r-b" }]],
    ["a price on a line", [{ skuId: "a", paidCases: 1, casePricePaise: 1 }]],
    ["51 lines", Array.from({ length: 51 }, (_, i) => ({ skuId: `s${i}`, paidCases: 1 }))],
  ])("rejects %s", (_label, lines) => {
    expect(cartLinesSchema.safeParse(lines).success).toBe(false);
  });
});
