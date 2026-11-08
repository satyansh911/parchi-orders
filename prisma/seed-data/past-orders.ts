// Plan for synthetic past orders (D36). Pure and deterministic: the same plan
// every run. The seed prices each planned order with the domain engine, at the
// tier and scheme rules in force on its order date.
//
// These are completed (EXPORTED) orders from before the demo starts, used for
// order history, "Order again" (D9) and AI capture's retailer history (D10).

import { BRIEF_SKU_CODES, SKUS } from "./catalogue";
import { RETAILERS } from "./people";

export type PastOrderPlan = {
  retailerCode: string;
  /** Sequence within the retailer, from 1. */
  index: number;
  placedAt: Date;
  lines: Array<{ skuCode: string; paidCases: number }>;
};

/**
 * R-0001 is the main demo retailer: their history contains the three brief
 * SKUs, so the brief's sample message maps from history (D10).
 * R-0003 regularly buys tea DUST 250 g instead, so history can tell the two
 * "chai patti 250" products apart in the AI evaluation.
 */
const FIXED_REGULARS: Record<string, string[]> = {
  "R-0001": [...BRIEF_SKU_CODES, "SKU-NM-200", "SKU-HL-100", "SKU-DW-200"],
  "R-0003": ["SKU-TD-250", "SKU-BS-150", "SKU-DT-500", "SKU-CP-100", "SKU-MX-200"],
};

const FIRST_ORDER_DAY_UTC = Date.UTC(2026, 8, 12); // 12 Sep 2026
const DAY_MS = 24 * 60 * 60 * 1000;

export function planPastOrders(): PastOrderPlan[] {
  const rand = mulberry32(20261108);
  const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
  const plans: PastOrderPlan[] = [];

  for (const retailer of RETAILERS) {
    const regulars = FIXED_REGULARS[retailer.code] ?? pickDistinct(SKUS.map((s) => s.code), 5 + Math.floor(rand() * 3), rand);
    const orderCount = 3 + Math.floor(rand() * 4); // 3–6

    for (let index = 1; index <= orderCount; index++) {
      const lineCount = Math.min(regulars.length, 2 + Math.floor(rand() * 4)); // 2–5
      const lines = pickDistinct(regulars, lineCount, rand).map((skuCode) => ({
        skuCode,
        // Mostly small orders, sometimes 10–12 cases so free goods appear in history.
        paidCases: rand() < 0.15 ? pick([10, 12]) : 1 + Math.floor(rand() * 8),
      }));
      // About 10 days apart, at a shop-hours time between 09:00 and 20:00 IST.
      const day = FIRST_ORDER_DAY_UTC + ((index - 1) * 10 + Math.floor(rand() * 4)) * DAY_MS;
      const minutesAfter0330Utc = Math.floor(rand() * 11 * 60);
      const placedAt = new Date(day + (3 * 60 + 30 + minutesAfter0330Utc) * 60 * 1000);
      plans.push({ retailerCode: retailer.code, index, placedAt, lines });
    }
  }
  return plans;
}

function pickDistinct<T>(items: readonly T[], count: number, rand: () => number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < count && pool.length > 0) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return out;
}

/** Small deterministic PRNG so the seed is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
