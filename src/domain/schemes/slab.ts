// Slab discount (A.4): `discountBps` off the WHOLE line once paid cases reach
// `minCases`. Calculated on the taxable value before GST, rounded half-up (D6).

import { DomainError } from "../errors";
import { applyBps, assertPaise } from "../money/paise";
import { assertCaseCount } from "./free-goods";
import type { SlabDiscountScheme } from "./types";

export type SlabOutcome = { eligible: boolean; discountBps: number; discountPaise: number };

export function slabOutcome(scheme: SlabDiscountScheme, paidCases: number, casePricePaise: number): SlabOutcome {
  assertValidSlab(scheme);
  assertCaseCount(paidCases, "paidCases");
  assertPaise(casePricePaise, "casePricePaise");

  if (paidCases < scheme.minCases) return { eligible: false, discountBps: 0, discountPaise: 0 };
  const taxablePaise = paidCases * casePricePaise;
  return { eligible: true, discountBps: scheme.discountBps, discountPaise: applyBps(taxablePaise, scheme.discountBps) };
}

export function assertValidSlab(scheme: SlabDiscountScheme): void {
  if (!Number.isSafeInteger(scheme.minCases) || scheme.minCases <= 0) {
    throw new DomainError("INVALID_SCHEME", `scheme ${scheme.id}: minCases must be a positive integer, got ${scheme.minCases}`);
  }
  if (!Number.isInteger(scheme.discountBps) || scheme.discountBps <= 0 || scheme.discountBps > 10_000) {
    throw new DomainError("INVALID_SCHEME", `scheme ${scheme.id}: discountBps must be 1..10000, got ${scheme.discountBps}`);
  }
}
