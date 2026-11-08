// The single conversion from database rows to domain engine types.
// Used by the server (catalogue, cart, orders) and the seed, so every caller
// prices with exactly the same inputs.

import type { Scheme as SchemeRow, Sku as SkuRow } from "@/generated/prisma/client";
import { DomainError } from "@/domain/errors";
import type { CatalogueSku } from "@/domain/pricing/price-line";
import type { Scheme } from "@/domain/schemes/types";

export function toDomainScheme(row: SchemeRow): Scheme {
  const base = {
    id: row.id,
    labelEn: row.labelEn,
    labelHi: row.labelHi,
    active: row.active,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
  };
  if (row.type === "FREE_GOODS") {
    if (row.buyCases === null || row.freeCases === null) {
      throw new DomainError("INVALID_SCHEME", `scheme ${row.id}: FREE_GOODS needs buyCases and freeCases`);
    }
    return { ...base, type: "FREE_GOODS", buyCases: row.buyCases, freeCases: row.freeCases };
  }
  if (row.minCases === null || row.discountBps === null) {
    throw new DomainError("INVALID_SCHEME", `scheme ${row.id}: SLAB_DISCOUNT needs minCases and discountBps`);
  }
  return { ...base, type: "SLAB_DISCOUNT", minCases: row.minCases, discountBps: row.discountBps };
}

export function toCatalogueSku(row: SkuRow & { schemes: SchemeRow[] }): CatalogueSku {
  return {
    id: row.id,
    code: row.code,
    nameEn: row.nameEn,
    nameHi: row.nameHi,
    active: row.active,
    dealerPricePaise: row.dealerPricePaise,
    dealerPriceUnit: row.dealerPriceUnit,
    piecesPerCase: row.piecesPerCase,
    gstBps: row.gstBps,
    schemes: row.schemes.map(toDomainScheme),
  };
}
