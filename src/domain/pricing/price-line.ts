// Prices one order line (D6, D14, D22). Single source of truth: the cart
// preview, the server and the seed all call this.
//
//   case price = tier-discounted case price (rounded once per case)
//   taxable    = paid cases x case price          (free cases add nothing)
//   discount   = best slab offer on the taxable value, rounded half-up
//   GST        = (taxable - discount) x GST rate, rounded half-up, per line
//   total      = taxable - discount + GST
//
// Stock is not considered here; see src/domain/stock.

import { DomainError } from "../errors";
import { applyBps, assertBps } from "../money/paise";
import { selectBestOffer, type Offer } from "../schemes/best-offer";
import type { Scheme } from "../schemes/types";
import { casePricePaise, type PriceUnit } from "./case-price";
import { MAX_CASES_PER_LINE } from "./limits";

export type CatalogueSku = {
  id: string;
  code: string;
  nameEn: string;
  nameHi: string;
  active: boolean;
  dealerPricePaise: number;
  dealerPriceUnit: PriceUnit;
  piecesPerCase: number;
  gstBps: number;
  schemes: readonly Scheme[];
};

export type PricingContext = {
  /** The retailer's tier discount (D5). */
  tierDiscountBps: number;
  /** Server time used to decide which schemes are active (D43). */
  now: Date;
};

export type LineInput = { sku: CatalogueSku; paidCases: number };

export type PricedLine = {
  skuId: string;
  paidCases: number;
  freeCases: number;
  casePricePaise: number;
  taxablePaise: number;
  discountBps: number;
  discountPaise: number;
  gstBps: number;
  gstPaise: number;
  lineTotalPaise: number;
  /** Reference value of free goods; not taxable (D6, C.22). */
  freeValuePaise: number;
  applied: Offer | null;
  otherOffer: Offer | null;
};

export type PriceLineOptions = { excludeFreeGoods?: boolean };

export function priceLine({ sku, paidCases }: LineInput, ctx: PricingContext, options: PriceLineOptions = {}): PricedLine {
  assertPaidCases(paidCases, sku.code);
  if (!sku.active) throw new DomainError("SKU_INACTIVE", `${sku.code} is not available for ordering`);
  assertBps(sku.gstBps, `${sku.code} gstBps`);

  const casePrice = casePricePaise(sku, ctx.tierDiscountBps);
  const { applied, otherOffer } = selectBestOffer({
    schemes: sku.schemes,
    paidCases,
    casePricePaise: casePrice,
    now: ctx.now,
    excludeFreeGoods: options.excludeFreeGoods,
  });

  const taxablePaise = paidCases * casePrice;
  const discountPaise = applied?.discountPaise ?? 0;
  const gstPaise = applyBps(taxablePaise - discountPaise, sku.gstBps);
  const freeCases = applied?.freeCases ?? 0;

  return {
    skuId: sku.id,
    paidCases,
    freeCases,
    casePricePaise: casePrice,
    taxablePaise,
    discountBps: applied?.discountBps ?? 0,
    discountPaise,
    gstBps: sku.gstBps,
    gstPaise,
    lineTotalPaise: taxablePaise - discountPaise + gstPaise,
    freeValuePaise: freeCases * casePrice,
    applied,
    otherOffer,
  };
}

/** Whole cases, 1 to 999 per line (C.4, D45). */
export function assertPaidCases(paidCases: number, skuCode: string): void {
  if (!Number.isSafeInteger(paidCases) || paidCases < 1 || paidCases > MAX_CASES_PER_LINE) {
    throw new DomainError(
      "INVALID_QUANTITY",
      `${skuCode}: paid cases must be a whole number from 1 to ${MAX_CASES_PER_LINE}, got ${paidCases}`,
    );
  }
}
