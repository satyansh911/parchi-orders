import { describe, expect, it } from "vitest";
import { DomainError } from "../errors";
import { isSchemeActive, istDayRange } from "./validity";

const window = (startsAt: string | null, endsAt: string | null, active = true) => ({
  active,
  startsAt: startsAt ? new Date(startsAt) : null,
  endsAt: endsAt ? new Date(endsAt) : null,
});
const at = (iso: string) => new Date(iso);

describe("isSchemeActive: half-open [startsAt, endsAt) (D43)", () => {
  it("is active with no dates", () => {
    expect(isSchemeActive(window(null, null), at("2026-11-08T10:00:00Z"))).toBe(true);
  });

  it("is active exactly at its start and inactive before it", () => {
    const s = window("2026-11-10T00:00:00Z", null);
    expect(isSchemeActive(s, at("2026-11-10T00:00:00Z"))).toBe(true);
    expect(isSchemeActive(s, at("2026-11-09T23:59:59.999Z"))).toBe(false);
  });

  it("is inactive exactly at its end and active just before it", () => {
    const s = window(null, "2026-11-01T00:00:00Z");
    expect(isSchemeActive(s, at("2026-10-31T23:59:59.999Z"))).toBe(true);
    expect(isSchemeActive(s, at("2026-11-01T00:00:00Z"))).toBe(false);
  });

  it("is never active when switched off, even inside its dates", () => {
    expect(isSchemeActive(window(null, null, false), at("2026-11-08T10:00:00Z"))).toBe(false);
  });
});

describe("istDayRange: date-only dates are whole IST calendar days (D43)", () => {
  const oct = istDayRange("2026-10-01", "2026-10-31");

  it("starts at 00:00 IST on the first day and ends (exclusive) at 00:00 IST after the last", () => {
    expect(oct.startsAt.toISOString()).toBe("2026-09-30T18:30:00.000Z");
    expect(oct.endsAt.toISOString()).toBe("2026-10-31T18:30:00.000Z");
  });

  it("includes the whole of the last IST day and nothing after", () => {
    const s = { active: true, ...oct };
    expect(isSchemeActive(s, at("2026-10-31T18:29:59.999Z"))).toBe(true); // 31 Oct 23:59:59.999 IST
    expect(isSchemeActive(s, at("2026-10-31T18:30:00.000Z"))).toBe(false); // 1 Nov 00:00 IST
    expect(isSchemeActive(s, at("2026-09-30T18:29:59.999Z"))).toBe(false); // 30 Sep 23:59 IST
  });

  it("supports a single-day scheme", () => {
    const day = istDayRange("2026-11-08", "2026-11-08");
    expect(day.endsAt.getTime() - day.startsAt.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("crosses month and year ends", () => {
    expect(istDayRange("2026-12-31", "2026-12-31").endsAt.toISOString()).toBe("2026-12-31T18:30:00.000Z");
  });

  it("rejects malformed or impossible dates and reversed ranges", () => {
    expect(() => istDayRange("2026/10/01", "2026-10-31")).toThrow(DomainError);
    expect(() => istDayRange("2026-02-30", "2026-03-01")).toThrow(DomainError);
    expect(() => istDayRange("2026-10-31", "2026-10-01")).toThrow(DomainError);
  });
});
