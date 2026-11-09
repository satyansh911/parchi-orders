// What a product card shows for the cases in the cart (redesign): the
// discounted case price (with the original struck through) or the free cases
// earned, and how far the next free case is. Display only: the cart and order
// placement price everything with the real engine (D74). Follows the same
// best-offer rule (D2): never stacked, the higher value wins, a tie goes to
// the discount.

export type CardOfferTerms = { type: "FREE_GOODS" | "SLAB_DISCOUNT"; buyCases: number | null; freeCases: number | null; minCases: number | null; discountBps: number | null };

export type CardOffer =
  | { kind: "NONE" }
  | { kind: "DISCOUNT"; discountBps: number; casePricePaise: number; savedPaise: number }
  | { kind: "FREE"; freeCases: number; freeValuePaise: number };

export type FreeProgress = { have: number; need: number; freeCases: number } | null;

const roundHalfUp = (n: number) => Math.floor(n + 0.5);

export function cardOffer(casePricePaise: number, cases: number, offers: readonly CardOfferTerms[]): CardOffer {
  let best: CardOffer = { kind: "NONE" };
  let bestValue = 0;
  for (const o of offers) {
    if (o.type === "SLAB_DISCOUNT" && o.minCases && o.discountBps && cases >= o.minCases) {
      const saved = roundHalfUp((casePricePaise * cases * o.discountBps) / 10_000);
      if (saved >= bestValue && saved > 0) {
        best = { kind: "DISCOUNT", discountBps: o.discountBps, casePricePaise: casePricePaise - roundHalfUp((casePricePaise * o.discountBps) / 10_000), savedPaise: saved };
        bestValue = saved;
      }
    }
    if (o.type === "FREE_GOODS" && o.buyCases && o.freeCases && cases >= o.buyCases) {
      const free = Math.floor(cases / o.buyCases) * o.freeCases;
      const value = free * casePricePaise;
      if (value > bestValue) {
        best = { kind: "FREE", freeCases: free, freeValuePaise: value };
        bestValue = value;
      }
    }
  }
  return best;
}

/** Progress towards the next free case(s), for the "add N more" bar. */
export function freeProgress(cases: number, offers: readonly CardOfferTerms[]): FreeProgress {
  const o = offers.find((x) => x.type === "FREE_GOODS" && x.buyCases && x.freeCases);
  if (!o || cases === 0) return null;
  const buy = o.buyCases!;
  const have = cases % buy;
  return { have, need: buy, freeCases: o.freeCases! };
}
