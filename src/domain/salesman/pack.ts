// D108: the salesman's offline pack, as plain JSON (dates as ISO strings) so
// it can be stored on the phone, plus the helpers that turn it back into the
// domain engine's inputs. Shared by the server (building) and the phone (pricing).

import type { CreditPosition } from "../credit/credit";
import type { CatalogueSku } from "../pricing/price-line";
import type { Scheme } from "../schemes/types";

type JsonScheme = Omit<Scheme, "startsAt" | "endsAt"> & { startsAt: string | null; endsAt: string | null };
export type PackSku = Omit<CatalogueSku, "schemes"> & {
  schemes: JsonScheme[];
  packSize: string;
  brand: string;
  imageKey: string;
  categoryEn: string;
  categoryHi: string;
  mrpPaise: number | null;
  availableCases: number;
};
export type PackShop = {
  id: string;
  code: string;
  shopName: string;
  ownerName: string;
  area: string;
  phone: string | null;
  tierName: string;
  tierDiscountBps: number;
  credit: CreditPosition;
  lastOrderAt: string | null;
};
export type SalesmanPack = { v: 1; generatedAt: string; salesmanName: string; skus: PackSku[]; shops: PackShop[] };

export function toJsonScheme(s: Scheme): JsonScheme {
  return { ...s, startsAt: s.startsAt ? s.startsAt.toISOString() : null, endsAt: s.endsAt ? s.endsAt.toISOString() : null } as JsonScheme;
}

export function packSkuToCatalogue(p: PackSku): CatalogueSku {
  return {
    id: p.id, code: p.code, nameEn: p.nameEn, nameHi: p.nameHi, active: p.active,
    dealerPricePaise: p.dealerPricePaise, dealerPriceUnit: p.dealerPriceUnit, piecesPerCase: p.piecesPerCase, gstBps: p.gstBps,
    schemes: p.schemes.map((s) => ({ ...s, startsAt: s.startsAt ? new Date(s.startsAt) : null, endsAt: s.endsAt ? new Date(s.endsAt) : null }) as Scheme),
  };
}
