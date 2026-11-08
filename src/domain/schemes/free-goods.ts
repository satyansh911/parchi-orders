// Buy X get Y free goods (A.3, D2, D50).
// Free cases are given per complete multiple of PAID cases; free cases never
// count toward the threshold. Their value uses the retailer's own case price.

import { DomainError } from "../errors";
import { assertPaise } from "../money/paise";
import type { FreeGoodsScheme } from "./types";

export type FreeGoodsOutcome = { freeCases: number; freeValuePaise: number };

export function freeGoodsOutcome(
  scheme: FreeGoodsScheme,
  paidCases: number,
  casePricePaise: number,
): FreeGoodsOutcome {
  assertValidFreeGoods(scheme);
  assertCaseCount(paidCases, "paidCases");
  assertPaise(casePricePaise, "casePricePaise");

  const freeCases = Math.floor(paidCases / scheme.buyCases) * scheme.freeCases;
  return { freeCases, freeValuePaise: freeCases * casePricePaise };
}

export function assertValidFreeGoods(scheme: FreeGoodsScheme): void {
  for (const [field, value] of [["buyCases", scheme.buyCases], ["freeCases", scheme.freeCases]] as const) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new DomainError("INVALID_SCHEME", `scheme ${scheme.id}: ${field} must be a positive integer, got ${value}`);
    }
  }
}

/** Whole, non-negative cases. Orders are in whole cases only (C.4). */
export function assertCaseCount(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainError("INVALID_QUANTITY", `${field} must be a whole number of cases, got ${value}`);
  }
}
