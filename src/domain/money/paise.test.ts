import { describe, expect, it } from "vitest";
import { DomainError } from "../errors";
import { BPS_DENOMINATOR, applyBps, assertBps, assertPaise, roundHalfUp, subtractBps } from "./paise";

describe("roundHalfUp", () => {
  it("rounds .5 up and everything else to nearest", () => {
    expect(roundHalfUp(25, 10)).toBe(3); // 2.5
    expect(roundHalfUp(24, 10)).toBe(2); // 2.4
    expect(roundHalfUp(26, 10)).toBe(3); // 2.6
    expect(roundHalfUp(15, 10)).toBe(2); // 1.5
  });

  it("leaves exact results unchanged", () => {
    expect(roundHalfUp(30, 10)).toBe(3);
    expect(roundHalfUp(0, 7)).toBe(0);
  });

  it("rejects negative, non-integer, non-finite and unsafe inputs", () => {
    expect(() => roundHalfUp(-5, 10)).toThrow(DomainError);
    expect(() => roundHalfUp(2.5, 10)).toThrow(DomainError);
    expect(() => roundHalfUp(Number.NaN, 10)).toThrow(DomainError);
    expect(() => roundHalfUp(Number.POSITIVE_INFINITY, 10)).toThrow(DomainError);
    expect(() => roundHalfUp(Number.MAX_SAFE_INTEGER + 1, 10)).toThrow(DomainError);
    expect(() => roundHalfUp(10, 0)).toThrow(DomainError);
  });
});

describe("applyBps / subtractBps", () => {
  it("takes a basis-point share of an amount, rounded half-up", () => {
    expect(applyBps(1_015_000, 300)).toBe(30_450); // 3% of ₹10,150
    expect(applyBps(2_775, 1800)).toBe(500); // 499.5 → 500
    expect(applyBps(714_420, 300)).toBe(21_433); // 21,432.6 → 21,433
  });

  it("subtracts a basis-point discount, rounding the result half-up once", () => {
    expect(subtractBps(77_760, 200)).toBe(76_205); // 76,204.8
    expect(subtractBps(77_775, 200)).toBe(76_220); // 76,219.5 → up
    expect(subtractBps(77_760, 0)).toBe(77_760);
  });

  it("uses 10,000 basis points = 100%", () => {
    expect(BPS_DENOMINATOR).toBe(10_000);
    expect(applyBps(12_345, 10_000)).toBe(12_345);
    expect(subtractBps(12_345, 10_000)).toBe(0);
  });
});

describe("validators", () => {
  it("assertPaise accepts non-negative safe integers only", () => {
    expect(() => assertPaise(0, "x")).not.toThrow();
    expect(() => assertPaise(810, "x")).not.toThrow();
    for (const bad of [-1, 8.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => assertPaise(bad, "x")).toThrow(DomainError);
    }
  });

  it("assertBps accepts integers 0..10000 only", () => {
    expect(() => assertBps(0, "x")).not.toThrow();
    expect(() => assertBps(10_000, "x")).not.toThrow();
    for (const bad of [-1, 10_001, 2.5, Number.NaN]) {
      expect(() => assertBps(bad, "x")).toThrow(DomainError);
    }
  });

  it("reports which field was invalid", () => {
    expect(() => assertPaise(-1, "dealerPricePaise")).toThrow(/dealerPricePaise/);
  });
});
