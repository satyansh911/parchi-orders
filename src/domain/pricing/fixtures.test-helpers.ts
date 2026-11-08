// Test-only catalogue builders. Values for the brief SKUs match the seed data.
import { freeGoods, slab } from "../schemes/fixtures.test-helpers";
import type { CatalogueSku } from "./price-line";

const sku = (code: string, fields: Partial<CatalogueSku> & Pick<CatalogueSku, "dealerPricePaise" | "piecesPerCase" | "gstBps">): CatalogueSku => ({
  id: `id-${code}`,
  code,
  nameEn: code,
  nameHi: code,
  active: true,
  dealerPriceUnit: "PIECE",
  schemes: [],
  ...fields,
});

export const BISCUIT_75G = sku("SKU-BS-075", { dealerPricePaise: 810, piecesPerCase: 96, gstBps: 500, schemes: [freeGoods(10, 1)] });
export const DETERGENT_1KG = sku("SKU-DT-1KG", { dealerPricePaise: 10_150, piecesPerCase: 20, gstBps: 1800, schemes: [slab(5, 300)] });
export const TEA_250G = sku("SKU-TE-250", { dealerPricePaise: 11_800, piecesPerCase: 40, gstBps: 500 });
export const CREAM_100G = sku("SKU-CR-100", { dealerPricePaise: 2_430, piecesPerCase: 60, gstBps: 500, schemes: [freeGoods(10, 1), slab(5, 300)] });

/** A SKU priced per case, for synthetic rounding and limit cases. */
export const perCase = (code: string, casePricePaise: number, gstBps: number): CatalogueSku =>
  sku(code, { dealerPricePaise: casePricePaise, dealerPriceUnit: "CASE", piecesPerCase: 1, gstBps });

export const STANDARD = { tierDiscountBps: 0, now: new Date("2026-11-08T06:00:00Z") };
export const KEY_ACCOUNT = { tierDiscountBps: 200, now: new Date("2026-11-08T06:00:00Z") };
