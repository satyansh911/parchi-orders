// OTP brute-force limits on real Postgres (test branch only, D49, D56).
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { decrementCounter, incrementCounter } from "../rate-limit";
import { makeRetailer } from "../testing/fixtures";
import { createTestClient, resetTestDatabase, resolveTestDatabaseUrl } from "../testing/test-database";
import { OTP_WINDOW_MS } from "./login-limits";
import { requestLoginCode, verifyLoginCode, type LoginDeps } from "./login-service";
import { demoOtpProvider } from "./otp";

const db = createTestClient(resolveTestDatabaseUrl());
afterAll(() => db.$disconnect());
beforeEach(() => resetTestDatabase(db));

const NOW = new Date("2026-11-09T10:00:00Z");
const deps = (clientIp = "203.0.113.1", now = NOW): LoginDeps => ({ db, otp: demoOtpProvider, now: () => now, clientIp });
const wrong = (phone: string, d = deps()) => verifyLoginCode(d, { phone, code: "000000" }, undefined);
const right = (phone: string, d = deps()) => verifyLoginCode(d, { phone, code: "123456" }, undefined);
const errors = (results: Array<{ ok: boolean; error?: string }>) => results.map((r) => (r.ok ? "OK" : r.error));

describe("atomic counters", () => {
  it("50 simultaneous increments give exactly 1..50, never a lost update", async () => {
    const counts = await Promise.all(Array.from({ length: 50 }, () => incrementCounter(db, "k", OTP_WINDOW_MS, NOW)));
    expect([...counts].sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });

  it("never goes below zero", async () => {
    await incrementCounter(db, "k", OTP_WINDOW_MS, NOW);
    await decrementCounter(db, "k", OTP_WINDOW_MS, NOW);
    await decrementCounter(db, "k", OTP_WINDOW_MS, NOW);
    expect(await incrementCounter(db, "k", OTP_WINDOW_MS, NOW)).toBe(1);
  });

  it("stores hashed keys only: no phone number or IP in the table", async () => {
    await makeRetailer(db, "R-A", "9999900101");
    await wrong("9999900101");
    const dump = JSON.stringify(await db.rateLimitHit.findMany());
    expect(dump).not.toContain("9999900101");
    expect(dump).not.toContain("203.0.113.1");
  });
});

describe("failed code checks per phone (5 per 15 minutes)", () => {
  it("allows 5 wrong codes, then locks the phone", async () => {
    await makeRetailer(db, "R-A", "9999900101");
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await wrong("9999900101"));
    expect(errors(results)).toEqual([...Array(5).fill("INVALID_CREDENTIALS"), "RATE_LIMITED"]);
  });

  it("refuses even the correct code while locked, and creates no session", async () => {
    await makeRetailer(db, "R-A", "9999900101");
    for (let i = 0; i < 5; i++) await wrong("9999900101");
    expect(await right("9999900101")).toEqual({ ok: false, error: "RATE_LIMITED" });
    expect(await db.session.count()).toBe(0);
  });

  it("unlocks in the next 15-minute window", async () => {
    await makeRetailer(db, "R-A", "9999900101");
    for (let i = 0; i < 5; i++) await wrong("9999900101");
    const nextWindow = new Date(NOW.getTime() + OTP_WINDOW_MS);
    expect(await right("9999900101", deps("203.0.113.1", nextWindow))).toMatchObject({ ok: true });
  });

  it("doesn't count successful logins as failures", async () => {
    await makeRetailer(db, "R-A", "9999900101");
    for (let i = 0; i < 4; i++) await wrong("9999900101");
    for (let i = 0; i < 3; i++) expect(await right("9999900101")).toMatchObject({ ok: true });
    expect(await wrong("9999900101")).toEqual({ ok: false, error: "INVALID_CREDENTIALS" }); // 5th failure still allowed
    expect(await wrong("9999900101")).toEqual({ ok: false, error: "RATE_LIMITED" });
  });

  it("locks an unregistered number exactly like a registered one (no enumeration)", async () => {
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await right("9999900199"));
    expect(errors(results)).toEqual([...Array(5).fill("INVALID_CREDENTIALS"), "RATE_LIMITED"]);
  });

  it("is safe under concurrency: 12 simultaneous wrong codes → exactly 5 checked, 7 refused", async () => {
    await makeRetailer(db, "R-A", "9999900101");
    const results = await Promise.all(Array.from({ length: 12 }, () => wrong("9999900101")));
    const tally = errors(results).reduce<Record<string, number>>((t, e) => ({ ...t, [e!]: (t[e!] ?? 0) + 1 }), {});
    expect(tally).toEqual({ INVALID_CREDENTIALS: 5, RATE_LIMITED: 7 });
  });
});

describe("failed code checks per IP (20 per 15 minutes)", () => {
  it("locks an IP after 20 failures spread across different numbers", async () => {
    await makeRetailer(db, "R-A", "9999900101");
    for (let i = 0; i < 20; i++) await wrong(`99999002${String(i).padStart(2, "0")}`); // 20 different numbers, one wrong try each
    expect(await right("9999900101")).toEqual({ ok: false, error: "RATE_LIMITED" });
    expect(await right("9999900101", deps("198.51.100.9"))).toMatchObject({ ok: true }); // another IP is unaffected
  });
});

describe("code requests per phone (5 per 15 minutes)", () => {
  it("allows 5 requests, then refuses, for known and unknown numbers alike", async () => {
    await makeRetailer(db, "R-A", "9999900101");
    for (const phone of ["9999900101", "9999900199"]) {
      const results = [];
      for (let i = 0; i < 6; i++) results.push(await requestLoginCode(deps(), phone));
      expect(errors(results)).toEqual([...Array(5).fill("OK"), "RATE_LIMITED"]);
    }
  });
});
