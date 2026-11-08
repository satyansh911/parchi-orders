// Scheme shapes used by the engine. Mirrors the Scheme table, without Prisma.

type SchemeBase = {
  id: string;
  labelEn: string;
  labelHi: string;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

/** Buy `buyCases` paid cases, get `freeCases` of the same SKU free, per complete multiple (A.3, D50). */
export type FreeGoodsScheme = SchemeBase & {
  type: "FREE_GOODS";
  buyCases: number;
  freeCases: number;
};

/** `discountBps` off the whole line at `minCases` or more paid cases (A.4). */
export type SlabDiscountScheme = SchemeBase & {
  type: "SLAB_DISCOUNT";
  minCases: number;
  discountBps: number;
};

export type Scheme = FreeGoodsScheme | SlabDiscountScheme;
