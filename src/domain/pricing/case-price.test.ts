import { describe, expect, it } from "vitest";
import { DomainError } from "../errors";
import { casePricePaise, piecePriceForDisplay, type PricedSku } from "./case-price";

// Brief SKUs (DECISIONS A.1: dealer price is per piece).
const biscuit: PricedSku = { dealerPricePaise: 810, dealerPriceUnit: "PIECE", piecesPerCase: 96 };
const detergent: PricedSku = { dealerPricePaise: 10_150, dealerPriceUnit: "PIECE", piecesPerCase: 20 };
const tea: PricedSku = { dealerPricePaise: 11_800, dealerPriceUnit: "PIECE", piecesPerCase: 40 };

const STANDARD = 0;
const KEY_ACCOUNT = 200;

describe("casePricePaise", () => {
  it("multiplies piece price by pieces per case at the Standard tier", () => {
    expect(casePricePaise(biscuit, STANDARD)).toBe(77_760); // ₹777.60
    expect(casePricePaise(detergent, STANDARD)).toBe(203_000); // ₹2,030
    expect(casePricePaise(tea, STANDARD)).toBe(472_000); // ₹4,720
  });

  it("applies the tier discount to the case price, rounded half-up once per case (D5, D6)", () => {
    expect(casePricePaise(biscuit, KEY_ACCOUNT)).toBe(76_205); // 76,204.8
    expect(casePricePaise(detergent, KEY_ACCOUNT)).toBe(198_940);
    expect(casePricePaise(tea, KEY_ACCOUNT)).toBe(462_560);
  });

  it("rounds an exact half paisa up", () => {
    const sku: PricedSku = { dealerPricePaise: 77_775, dealerPriceUnit: "CASE", piecesPerCase: 1 };
    expect(casePricePaise(sku, KEY_ACCOUNT)).toBe(76_220); // 76,219.5
  });

  it("uses the dealer price as-is when it is quoted per case (A.1 configurable)", () => {
    const perCase: PricedSku = { dealerPricePaise: 77_760, dealerPriceUnit: "CASE", piecesPerCase: 96 };
    expect(casePricePaise(perCase, STANDARD)).toBe(77_760);
    expect(casePricePaise(perCase, KEY_ACCOUNT)).toBe(76_205);
  });

  it("rejects invalid configuration", () => {
    expect(() => casePricePaise({ ...biscuit, piecesPerCase: 0 }, STANDARD)).toThrow(DomainError);
    expect(() => casePricePaise({ ...biscuit, piecesPerCase: 1.5 }, STANDARD)).toThrow(DomainError);
    expect(() => casePricePaise({ ...biscuit, dealerPricePaise: 0 }, STANDARD)).toThrow(DomainError);
    expect(() => casePricePaise({ ...biscuit, dealerPricePaise: 8.1 }, STANDARD)).toThrow(DomainError);
    expect(() => casePricePaise(biscuit, -1)).toThrow(DomainError);
    expect(() => casePricePaise(biscuit, 10_001)).toThrow(DomainError);
  });
});

describe("piecePriceForDisplay", () => {
  it("divides the case price by pieces per case, rounded half-up (display only)", () => {
    expect(piecePriceForDisplay(77_760, 96)).toBe(810);
    expect(piecePriceForDisplay(76_205, 96)).toBe(794); // 793.8
    expect(piecePriceForDisplay(198_940, 20)).toBe(9_947);
  });
});
