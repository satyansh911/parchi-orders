// "Add N more" nudge (D19, D44): at most one useful nudge per line.
//
// Candidates: the next complete free-goods multiple, and the next slab not yet
// reached. A candidate is useful only if, at the target quantity:
//   - that scheme becomes the applied best offer,
//   - it beats the current offer (a different scheme, or more free cases),
//   - paid + free cases fit in available stock, within the line limit.
// The candidate needing the fewest extra cases wins. Two candidates with the
// same extra cases share the same target, where best-offer selection already
// picks the larger benefit.

import { assertCaseCount } from "../schemes/free-goods";
import { isSchemeActive } from "../schemes/validity";
import type { Scheme } from "../schemes/types";
import { MAX_CASES_PER_LINE } from "./limits";
import { assertPaidCases, priceLine, type CatalogueSku, type PricingContext } from "./price-line";

export type Nudge = {
  addCases: number;
  targetPaidCases: number;
  schemeId: string;
  type: Scheme["type"];
  labelEn: string;
  labelHi: string;
  /** Total free cases at the target. */
  freeCases: number;
  /** Free cases gained compared with now. */
  extraFreeCases: number;
  discountBps: number;
};

export type NudgeInput = { sku: CatalogueSku; paidCases: number; availableCases: number };

export function nudgeFor({ sku, paidCases, availableCases }: NudgeInput, ctx: PricingContext): Nudge | null {
  assertPaidCases(paidCases, sku.code);
  assertCaseCount(availableCases, "availableCases");

  const current = priceLine({ sku, paidCases }, ctx);
  if (current.paidCases + current.freeCases > availableCases) return null;

  const targets = new Set<number>();
  for (const scheme of sku.schemes) {
    if (!isSchemeActive(scheme, ctx.now)) continue;
    const target =
      scheme.type === "FREE_GOODS"
        ? (Math.floor(paidCases / scheme.buyCases) + 1) * scheme.buyCases
        : scheme.minCases > paidCases
          ? scheme.minCases
          : null;
    if (target !== null && target <= MAX_CASES_PER_LINE) targets.add(target);
  }

  for (const target of [...targets].sort((a, b) => a - b)) {
    const line = priceLine({ sku, paidCases: target }, ctx);
    const offer = line.applied;
    if (!offer) continue;
    const beatsCurrent = offer.id !== current.applied?.id || line.freeCases > current.freeCases;
    const fits = line.paidCases + line.freeCases <= availableCases;
    if (!beatsCurrent || !fits) continue;

    return {
      addCases: target - paidCases,
      targetPaidCases: target,
      schemeId: offer.id,
      type: offer.type,
      labelEn: offer.labelEn,
      labelHi: offer.labelHi,
      freeCases: line.freeCases,
      extraFreeCases: line.freeCases - current.freeCases,
      discountBps: offer.discountBps,
    };
  }
  return null;
}
