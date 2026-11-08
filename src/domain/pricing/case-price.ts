// Retailer's case price (DECISIONS A.1, D5, D6).
// Case price = dealer price per case, minus the retailer's tier discount,
// rounded half-up once per case. Schemes and GST apply on top of this.

import { DomainError } from "../errors";
import { assertBps, assertPaise, roundHalfUp, subtractBps } from "../money/paise";

export type PriceUnit = "PIECE" | "CASE";

export type PricedSku = {
  dealerPricePaise: number;
  /** Unit the dealer price is quoted in; demo data is per PIECE (A.1, C.3). */
  dealerPriceUnit: PriceUnit;
  piecesPerCase: number;
};

export function casePricePaise(sku: PricedSku, tierDiscountBps: number): number {
  assertPaise(sku.dealerPricePaise, "dealerPricePaise");
  if (sku.dealerPricePaise === 0) {
    throw new DomainError("INVALID_VALUE", "dealerPricePaise must be greater than 0");
  }
  if (!Number.isSafeInteger(sku.piecesPerCase) || sku.piecesPerCase <= 0) {
    throw new DomainError("INVALID_VALUE", `piecesPerCase must be a positive integer, got ${sku.piecesPerCase}`);
  }
  assertBps(tierDiscountBps, "tierDiscountBps");

  const listCasePrice =
    sku.dealerPriceUnit === "PIECE" ? sku.dealerPricePaise * sku.piecesPerCase : sku.dealerPricePaise;
  return subtractBps(listCasePrice, tierDiscountBps);
}

/** Per-piece price for display only; totals always use the case price. */
export function piecePriceForDisplay(casePrice: number, piecesPerCase: number): number {
  return roundHalfUp(casePrice, piecesPerCase);
}
