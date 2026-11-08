import { describe, expect, it } from "vitest";
import { DomainError } from "../errors";
import { slab } from "./fixtures.test-helpers";
import { slabOutcome } from "./slab";

const DETERGENT_STD = 203_000; // ₹2,030 per case
const CREAM_KEY = 142_884; // 145,800 at 2% off

describe("slabOutcome: discount on the whole line at the threshold (A.4)", () => {
  it("gives nothing below the threshold", () => {
    expect(slabOutcome(slab(5, 300), 4, DETERGENT_STD)).toEqual({ eligible: false, discountBps: 0, discountPaise: 0 });
  });

  it("applies to the whole line from exactly the threshold, not only cases above it", () => {
    expect(slabOutcome(slab(5, 300), 5, DETERGENT_STD)).toEqual({ eligible: true, discountBps: 300, discountPaise: 30_450 });
    expect(slabOutcome(slab(5, 300), 6, DETERGENT_STD).discountPaise).toBe(36_540);
  });

  it("rounds the discount half-up (D6)", () => {
    // 5 x 142,884 = 714,420; 3% = 21,432.6
    expect(slabOutcome(slab(5, 300), 5, CREAM_KEY).discountPaise).toBe(21_433);
  });

  it("rejects invalid scheme configuration", () => {
    expect(() => slabOutcome(slab(0, 300), 5, DETERGENT_STD)).toThrow(DomainError);
    expect(() => slabOutcome(slab(5, 0), 5, DETERGENT_STD)).toThrow(DomainError);
    expect(() => slabOutcome(slab(5, 10_001), 5, DETERGENT_STD)).toThrow(DomainError);
    expect(() => slabOutcome(slab(5, 2.5), 5, DETERGENT_STD)).toThrow(DomainError);
  });

  it("rejects invalid quantities", () => {
    expect(() => slabOutcome(slab(5, 300), -1, DETERGENT_STD)).toThrow(DomainError);
    expect(() => slabOutcome(slab(5, 300), 5.5, DETERGENT_STD)).toThrow(DomainError);
  });
});
