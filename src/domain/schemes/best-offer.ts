// Best-offer selection (D2, D46).
// Every active, eligible scheme is evaluated for the line; exactly one is
// applied: the highest monetary benefit to the retailer. Free-goods benefit =
// free cases x the retailer's case price. On a tie the discount wins, because
// it doesn't consume stock. Schemes never stack.

import { freeGoodsOutcome } from "./free-goods";
import { slabOutcome } from "./slab";
import type { Scheme } from "./types";
import { isSchemeActive } from "./validity";

export type Offer = {
  id: string;
  type: Scheme["type"];
  labelEn: string;
  labelHi: string;
  /** Money value to the retailer, used only to rank offers. */
  benefitPaise: number;
  freeCases: number;
  discountBps: number;
  discountPaise: number;
};

export type BestOffer = {
  applied: Offer | null;
  /** The best eligible offer of a DIFFERENT type, named in the UI (D46). */
  otherOffer: Offer | null;
};

export type BestOfferInput = {
  schemes: readonly Scheme[];
  paidCases: number;
  casePricePaise: number;
  now: Date;
  /** Leave out free-goods schemes (only when free goods don't fit in stock: D18, D42). */
  excludeFreeGoods?: boolean;
};

export function selectBestOffer(input: BestOfferInput): BestOffer {
  const offers = eligibleOffers(input).sort(compareOffers);
  const applied = offers[0] ?? null;
  const otherOffer = applied ? (offers.find((o) => o.type !== applied.type) ?? null) : null;
  return { applied, otherOffer };
}

export function eligibleOffers({ schemes, paidCases, casePricePaise, now, excludeFreeGoods = false }: BestOfferInput): Offer[] {
  const offers: Offer[] = [];
  for (const scheme of schemes) {
    if (!isSchemeActive(scheme, now)) continue;
    const base = { id: scheme.id, type: scheme.type, labelEn: scheme.labelEn, labelHi: scheme.labelHi };

    if (scheme.type === "FREE_GOODS") {
      if (excludeFreeGoods) continue;
      const { freeCases, freeValuePaise } = freeGoodsOutcome(scheme, paidCases, casePricePaise);
      if (freeCases > 0) {
        offers.push({ ...base, benefitPaise: freeValuePaise, freeCases, discountBps: 0, discountPaise: 0 });
      }
    } else {
      const { eligible, discountBps, discountPaise } = slabOutcome(scheme, paidCases, casePricePaise);
      if (eligible) {
        offers.push({ ...base, benefitPaise: discountPaise, freeCases: 0, discountBps, discountPaise });
      }
    }
  }
  return offers;
}

/** Highest benefit first; on a tie, discount before free goods; then by id for a stable order. */
function compareOffers(a: Offer, b: Offer): number {
  if (a.benefitPaise !== b.benefitPaise) return b.benefitPaise - a.benefitPaise;
  if (a.type !== b.type) return a.type === "SLAB_DISCOUNT" ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
