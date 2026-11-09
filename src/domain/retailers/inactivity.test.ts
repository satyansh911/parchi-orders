import { describe, expect, it } from "vitest";
import { byLongestGap, inactivity } from "./inactivity";

const NOW = new Date("2026-11-09T10:00:00Z");
const daysAgo = (d: number, extraMs = 0) => new Date(NOW.getTime() - d * 86_400_000 - extraMs);

describe("inactivity (D112)", () => {
  it("is inactive only after more than 14 whole days", () => {
    expect(inactivity(daysAgo(14), NOW)).toEqual({ inactive: false, daysSince: 14 });
    expect(inactivity(daysAgo(14, 3_600_000), NOW)).toEqual({ inactive: false, daysSince: 14 });
    expect(inactivity(daysAgo(15), NOW)).toEqual({ inactive: true, daysSince: 15 });
    expect(inactivity(daysAgo(0), NOW)).toEqual({ inactive: false, daysSince: 0 });
  });

  it("treats never-ordered shops as inactive", () => {
    expect(inactivity(null, NOW)).toEqual({ inactive: true, daysSince: null });
  });

  it("sorts never-ordered first, then the longest gap", () => {
    const list = [inactivity(daysAgo(20), NOW), inactivity(null, NOW), inactivity(daysAgo(40), NOW)];
    expect(list.sort(byLongestGap).map((x) => x.daysSince)).toEqual([null, 40, 20]);
  });
});
