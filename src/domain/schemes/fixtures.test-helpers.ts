// Test-only builders for schemes. Not imported by production code.
import type { FreeGoodsScheme, SlabDiscountScheme } from "./types";

export const freeGoods = (buyCases: number, freeCases: number, extra: Partial<FreeGoodsScheme> = {}): FreeGoodsScheme => ({
  id: `fg-${buyCases}-${freeCases}`,
  type: "FREE_GOODS",
  buyCases,
  freeCases,
  labelEn: `Buy ${buyCases} cases get ${freeCases} free`,
  labelHi: `${buyCases} पेटी पर ${freeCases} पेटी मुफ़्त`,
  active: true,
  startsAt: null,
  endsAt: null,
  ...extra,
});

export const slab = (minCases: number, discountBps: number, extra: Partial<SlabDiscountScheme> = {}): SlabDiscountScheme => ({
  id: `slab-${minCases}-${discountBps}`,
  type: "SLAB_DISCOUNT",
  minCases,
  discountBps,
  labelEn: `${discountBps / 100}% off on ${minCases} or more cases`,
  labelHi: `${minCases} या ज़्यादा पेटी पर ${discountBps / 100}% छूट`,
  active: true,
  startsAt: null,
  endsAt: null,
  ...extra,
});

export const NOW = new Date("2026-11-08T06:00:00Z");
