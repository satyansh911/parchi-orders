// Integer money helpers (DECISIONS #13, D6). All amounts are integer paise and
// all rates are integer basis points (1% = 100 bps). No floating-point money.

import { DomainError } from "../errors";

export const BPS_DENOMINATOR = 10_000;

/** Throws unless `value` is a non-negative safe integer number of paise. */
export function assertPaise(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainError("INVALID_VALUE", `${field} must be a non-negative integer number of paise, got ${value}`);
  }
}

/** Throws unless `value` is an integer rate between 0 and 10,000 basis points. */
export function assertBps(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0 || value > BPS_DENOMINATOR) {
    throw new DomainError("INVALID_VALUE", `${field} must be an integer between 0 and 10000 bps, got ${value}`);
  }
}

/**
 * numerator / denominator rounded half-up, in integer arithmetic.
 * floor((2n + d) / 2d) equals round-half-up for n >= 0, d > 0.
 */
export function roundHalfUp(numerator: number, denominator: number): number {
  assertPaise(numerator, "numerator");
  if (!Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new DomainError("INVALID_VALUE", `denominator must be a positive integer, got ${denominator}`);
  }
  const doubled = 2 * numerator + denominator;
  if (!Number.isSafeInteger(doubled)) {
    throw new DomainError("INVALID_VALUE", "amount too large to round safely");
  }
  return Math.floor(doubled / (2 * denominator));
}

/** The `bps` share of `amountPaise`, rounded half-up (e.g. a 3% discount). */
export function applyBps(amountPaise: number, bps: number): number {
  assertPaise(amountPaise, "amountPaise");
  assertBps(bps, "bps");
  return roundHalfUp(amountPaise * bps, BPS_DENOMINATOR);
}

/** `amountPaise` reduced by `bps`, rounded half-up once (e.g. a tier discount). */
export function subtractBps(amountPaise: number, bps: number): number {
  assertPaise(amountPaise, "amountPaise");
  assertBps(bps, "bps");
  return roundHalfUp(amountPaise * (BPS_DENOMINATOR - bps), BPS_DENOMINATOR);
}
