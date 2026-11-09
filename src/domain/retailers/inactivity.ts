// D112: a retailer is inactive when their last non-cancelled order is more
// than 14 days old, or they have never ordered. Whole days, by elapsed time.

export const INACTIVE_AFTER_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type Inactivity = { inactive: boolean; daysSince: number | null };

export function inactivity(lastOrderAt: Date | null, now: Date, afterDays = INACTIVE_AFTER_DAYS): Inactivity {
  if (!lastOrderAt) return { inactive: true, daysSince: null };
  const daysSince = Math.max(0, Math.floor((now.getTime() - lastOrderAt.getTime()) / DAY_MS));
  return { inactive: daysSince > afterDays, daysSince };
}

/** Never-ordered first, then the longest gap first. */
export function byLongestGap(a: Inactivity, b: Inactivity): number {
  if (a.daysSince === null) return b.daysSince === null ? 0 : -1;
  if (b.daysSince === null) return 1;
  return b.daysSince - a.daysSince;
}
