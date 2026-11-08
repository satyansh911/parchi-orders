import { describe, expect, it } from "vitest";
import { DomainError } from "../errors";
import { freeGoodsOutcome } from "./free-goods";
import type { FreeGoodsScheme } from "./types";

const scheme = (buyCases: number, freeCases: number): FreeGoodsScheme => ({
  id: `fg-${buyCases}-${freeCases}`,
  type: "FREE_GOODS",
  buyCases,
  freeCases,
  labelEn: `Buy ${buyCases} get ${freeCases}`,
  labelHi: "",
  active: true,
  startsAt: null,
  endsAt: null,
});

const BISCUIT_STD = 77_760;
const BISCUIT_KEY = 76_205;

describe("freeGoodsOutcome: free cases per complete multiple of paid cases (A.3)", () => {
  it.each([
    [0, 0],
    [9, 0],
    [10, 1],
    [11, 1],
    [19, 1],
    [20, 2],
    [21, 2],
    [100, 10],
  ])("buy 10 get 1: %i paid → %i free", (paid, free) => {
    expect(freeGoodsOutcome(scheme(10, 1), paid, BISCUIT_STD).freeCases).toBe(free);
  });

  it("never counts free cases toward the threshold: 19 paid gives 1 free, not 2", () => {
    expect(freeGoodsOutcome(scheme(10, 1), 19, BISCUIT_STD).freeCases).toBe(1);
  });

  it("handles other ratios: buy 20 get 1 and buy 10 get 2", () => {
    expect(freeGoodsOutcome(scheme(20, 1), 19, 1).freeCases).toBe(0);
    expect(freeGoodsOutcome(scheme(20, 1), 20, 1).freeCases).toBe(1);
    expect(freeGoodsOutcome(scheme(20, 1), 40, 1).freeCases).toBe(2);
    expect(freeGoodsOutcome(scheme(10, 2), 25, 1).freeCases).toBe(4);
  });

  it("values free goods at the retailer's own case price (D2)", () => {
    expect(freeGoodsOutcome(scheme(10, 1), 10, BISCUIT_STD).freeValuePaise).toBe(77_760);
    expect(freeGoodsOutcome(scheme(10, 1), 10, BISCUIT_KEY).freeValuePaise).toBe(76_205);
    expect(freeGoodsOutcome(scheme(10, 1), 21, BISCUIT_KEY).freeValuePaise).toBe(152_410);
  });

  it("rejects invalid quantities", () => {
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => freeGoodsOutcome(scheme(10, 1), bad, BISCUIT_STD)).toThrow(DomainError);
    }
  });

  it("rejects invalid scheme configuration", () => {
    expect(() => freeGoodsOutcome(scheme(0, 1), 10, BISCUIT_STD)).toThrow(/INVALID_SCHEME|buyCases/);
    expect(() => freeGoodsOutcome(scheme(10, 0), 10, BISCUIT_STD)).toThrow(DomainError);
    expect(() => freeGoodsOutcome(scheme(10.5, 1), 10, BISCUIT_STD)).toThrow(DomainError);
  });
});
