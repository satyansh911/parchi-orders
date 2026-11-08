// Scheme validity window (D43).
// Active on the half-open interval [startsAt, endsAt). Date-only dates are IST
// calendar dates covering the whole day; instants are stored in UTC.

import { DomainError } from "../errors";

type Window = { active: boolean; startsAt: Date | null; endsAt: Date | null };

export function isSchemeActive(scheme: Window, now: Date): boolean {
  if (!scheme.active) return false;
  const t = now.getTime();
  if (scheme.startsAt && t < scheme.startsAt.getTime()) return false;
  if (scheme.endsAt && t >= scheme.endsAt.getTime()) return false;
  return true;
}

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Converts inclusive IST calendar dates ("2026-10-01" to "2026-10-31") into the
 * stored half-open UTC window: 00:00 IST on the first day up to 00:00 IST on
 * the day after the last.
 */
export function istDayRange(firstDay: string, lastDay: string): { startsAt: Date; endsAt: Date } {
  const start = istMidnightUtcMs(firstDay);
  const end = istMidnightUtcMs(lastDay) + DAY_MS;
  if (end <= start) {
    throw new DomainError("INVALID_VALUE", `scheme ends (${lastDay}) before it starts (${firstDay})`);
  }
  return { startsAt: new Date(start), endsAt: new Date(end) };
}

function istMidnightUtcMs(day: string): number {
  const match = DATE_ONLY.exec(day);
  if (!match) throw new DomainError("INVALID_VALUE", `expected a YYYY-MM-DD date, got "${day}"`);
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const utcMidnight = Date.UTC(y, m - 1, d);
  const check = new Date(utcMidnight);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new DomainError("INVALID_VALUE", `"${day}" is not a real calendar date`);
  }
  return utcMidnight - IST_OFFSET_MS;
}
