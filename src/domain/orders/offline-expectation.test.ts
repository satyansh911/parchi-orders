import { describe, expect, it } from "vitest";
import { expectationOf, sameExpectation } from "./offline-expectation";

const a = { skuId: "a", paidCases: 10, freeCases: 1, lineTotalPaise: 816_480 };
const b = { skuId: "b", paidCases: 2, freeCases: 0, lineTotalPaise: 479_080 };

describe("offline expectation (D108)", () => {
  it("ignores line order", () => {
    expect(sameExpectation(expectationOf([a, b], 1_295_560, false), expectationOf([b, a], 1_295_560, false))).toBe(true);
  });

  it("detects a changed price, scheme (free goods), quantity or credit outcome", () => {
    const base = expectationOf([a, b], 1_295_560, false);
    expect(sameExpectation(base, expectationOf([{ ...a, lineTotalPaise: 816_481 }, b], 1_295_561, false))).toBe(false);
    expect(sameExpectation(base, expectationOf([{ ...a, freeCases: 0 }, b], 1_295_560, false))).toBe(false);
    expect(sameExpectation(base, expectationOf([a], 816_480, false))).toBe(false);
    expect(sameExpectation(base, expectationOf([a, b], 1_295_560, true))).toBe(false);
  });
});
