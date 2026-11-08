// Checks one requested line against available stock (A.5, D4, D7, D18, D34, D42, D47).
//
// Rules:
// - Paid AND free cases consume stock. A line is OK only if paid + free fit.
// - Never change the requested quantity: when it doesn't fit, return options
//   for the retailer to pick explicitly.
// - When free goods don't fit, the options are:
//     WITH_FREE_GOODS    the largest paid quantity whose paid + free cases fit
//                        (only if that still includes free goods);
//     WITHOUT_FREE_GOODS the requested quantity (capped at available) with the
//                        best offer that has no free goods (a discount or none).
// - When no free goods are involved and more than available is asked for:
//     MAX_AVAILABLE      the available quantity with its best offer.
// - The WITHOUT_FREE_GOODS choice is accepted only when free goods really don't
//   fit; otherwise OFFER_CHANGED with the current best line, so the client can
//   never bypass the best-offer rule (D34) and nothing switches silently (D47).

import { DomainError } from "../errors";
import { assertCaseCount } from "../schemes/free-goods";
import { assertPaidCases, priceLine, type CatalogueSku, type PricedLine, type PricingContext } from "../pricing/price-line";

export type OfferChoice = "BEST" | "WITHOUT_FREE_GOODS";
export type OfferSelection = "BEST_OFFER" | "WITHOUT_FREE_GOODS_STOCK_SHORT";

export type StockOption = {
  kind: "WITH_FREE_GOODS" | "WITHOUT_FREE_GOODS" | "MAX_AVAILABLE";
  /** The choice to send back to accept this option. */
  choice: OfferChoice;
  line: PricedLine;
};

export type LineStockResult =
  | { status: "OK"; selection: OfferSelection; line: PricedLine }
  | { status: "OUT_OF_STOCK" }
  | { status: "STOCK_SHORT"; reason: "MORE_THAN_AVAILABLE" | "FREE_GOODS_DONT_FIT"; options: StockOption[] }
  | { status: "OFFER_CHANGED"; current: Exclude<LineStockResult, { status: "OFFER_CHANGED" }> };

export type LineStockInput = {
  sku: CatalogueSku;
  requestedCases: number;
  /** stockCases - reservedCases (see availableCases). */
  availableCases: number;
  choice?: OfferChoice;
};

/** D4: available = stock - reserved. */
export function availableCases(stockCases: number, reservedCases: number): number {
  assertCaseCount(stockCases, "stockCases");
  assertCaseCount(reservedCases, "reservedCases");
  if (reservedCases > stockCases) {
    throw new DomainError("INVALID_VALUE", `reserved (${reservedCases}) exceeds stock (${stockCases})`);
  }
  return stockCases - reservedCases;
}

export function evaluateLineStock(input: LineStockInput, ctx: PricingContext): LineStockResult {
  const { sku, requestedCases, availableCases: available, choice = "BEST" } = input;
  assertPaidCases(requestedCases, sku.code);
  assertCaseCount(available, "availableCases");

  if (choice === "WITHOUT_FREE_GOODS") {
    const best = evaluateLineStock({ ...input, choice: "BEST" }, ctx);
    const freeGoodsDontFit = best.status === "STOCK_SHORT" && best.reason === "FREE_GOODS_DONT_FIT";
    if (!freeGoodsDontFit) {
      // Asking for more than available still gets the normal options.
      if (best.status === "STOCK_SHORT" || best.status === "OUT_OF_STOCK") return best;
      return { status: "OFFER_CHANGED", current: best };
    }
    const line = priceLine({ sku, paidCases: requestedCases }, ctx, { excludeFreeGoods: true });
    return { status: "OK", selection: "WITHOUT_FREE_GOODS_STOCK_SHORT", line };
  }

  if (available === 0) return { status: "OUT_OF_STOCK" };

  const fits = (line: PricedLine) => line.paidCases + line.freeCases <= available;
  const requested = priceLine({ sku, paidCases: requestedCases }, ctx);
  if (requestedCases <= available && fits(requested)) {
    return { status: "OK", selection: "BEST_OFFER", line: requested };
  }

  const reason = requestedCases > available ? "MORE_THAN_AVAILABLE" : "FREE_GOODS_DONT_FIT";
  const capped = Math.min(requestedCases, available);
  const atCap = priceLine({ sku, paidCases: capped }, ctx);

  if (fits(atCap)) {
    // No free goods problem at the cap: just offer what's available.
    return { status: "STOCK_SHORT", reason, options: [{ kind: "MAX_AVAILABLE", choice: "BEST", line: atCap }] };
  }

  const options: StockOption[] = [];
  const withFree = largestFittingLine(sku, capped - 1, available, ctx);
  if (withFree && withFree.freeCases > 0) {
    options.push({ kind: "WITH_FREE_GOODS", choice: "BEST", line: withFree });
  }
  options.push({
    kind: "WITHOUT_FREE_GOODS",
    choice: "WITHOUT_FREE_GOODS",
    line: priceLine({ sku, paidCases: capped }, ctx, { excludeFreeGoods: true }),
  });
  return { status: "STOCK_SHORT", reason, options };
}

/**
 * Largest paid quantity <= maxPaid whose paid + free cases (with its best
 * offer) fit in stock. A simple downward search: at most 999 lines, and it
 * stays correct with several schemes on one SKU.
 */
function largestFittingLine(sku: CatalogueSku, maxPaid: number, available: number, ctx: PricingContext): PricedLine | null {
  for (let paid = maxPaid; paid >= 1; paid--) {
    const line = priceLine({ sku, paidCases: paid }, ctx);
    if (line.paidCases + line.freeCases <= available) return line;
  }
  return null;
}
