// Login flow against real Postgres (test branch only, D49).
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeDeskUser, makeRetailer } from "../testing/fixtures";
import { createTestClient, resetTestDatabase, resolveTestDatabaseUrl } from "../testing/test-database";
import { requestLoginCode, verifyLoginCode, type LoginDeps } from "./login-service";
import { demoOtpProvider } from "./otp";
import { findViewerByToken } from "./session-store";
import { hashSessionToken } from "./tokens";

const db = createTestClient(resolveTestDatabaseUrl());
afterAll(() => db.$disconnect());
beforeEach(() => resetTestDatabase(db));

const NOW = new Date("2026-11-09T10:00:00Z");
const demo: LoginDeps = { db, otp: demoOtpProvider, now: () => NOW };
const disabled: LoginDeps = { db, otp: null, now: () => NOW };

describe("requestLoginCode", () => {
  it("returns the demo code and the normalised number", async () => {
    await makeRetailer(db, "R-A", "9999900101");
    expect(await requestLoginCode(demo, "+91 99999 00101")).toEqual({ ok: true, phone: "9999900101", demoCode: "123456" });
  });

  it("answers identically for an unregistered number (no user enumeration)", async () => {
    await makeRetailer(db, "R-A", "9999900101");
    const known = await requestLoginCode(demo, "9999900101");
    const unknown = await requestLoginCode(demo, "9999900199");
    expect({ ...unknown, phone: "x" }).toEqual({ ...known, phone: "x" });
  });

  it("rejects an invalid number", async () => {
    expect(await requestLoginCode(demo, "12345")).toEqual({ ok: false, error: "INVALID_PHONE" });
  });

  it("refuses when demo OTP is not configured (D55)", async () => {
    expect(await requestLoginCode(disabled, "9999900101")).toEqual({ ok: false, error: "LOGIN_DISABLED" });
  });
});

describe("verifyLoginCode", () => {
  it("logs a retailer in with 123456 and stores only the token hash", async () => {
    const { user } = await makeRetailer(db, "R-A", "9999900101");
    const result = await verifyLoginCode(demo, { phone: "09999900101", code: "123456" }, undefined);
    expect(result).toMatchObject({ ok: true, role: "RETAILER" });
    if (!result.ok) throw new Error("expected login");
    expect(result.expiresAt.toISOString()).toBe("2026-11-16T10:00:00.000Z");
    const [session] = await db.session.findMany();
    expect(session).toMatchObject({ userId: user.id, tokenHash: hashSessionToken(result.token) });
    expect((await findViewerByToken(db, result.token, NOW))?.userId).toBe(user.id);
  });

  it("logs the desk in with the DESK role", async () => {
    await makeDeskUser(db, "9999900001");
    expect(await verifyLoginCode(demo, { phone: "9999900001", code: "123456" }, undefined)).toMatchObject({ ok: true, role: "DESK" });
  });

  it("gives the same error for a wrong code and an unknown number, and creates no session", async () => {
    await makeRetailer(db, "R-A", "9999900101");
    const wrongCode = await verifyLoginCode(demo, { phone: "9999900101", code: "654321" }, undefined);
    const unknownPhone = await verifyLoginCode(demo, { phone: "9999900199", code: "123456" }, undefined);
    expect(wrongCode).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
    expect(unknownPhone).toEqual(wrongCode);
    expect(await db.session.count()).toBe(0);
  });

  it("rejects malformed codes and numbers with the same generic error", async () => {
    await makeRetailer(db, "R-A", "9999900101");
    for (const input of [
      { phone: "9999900101", code: "12345" },
      { phone: "9999900101", code: "abcdef" },
      { phone: "9999900101", code: 123456 },
      { phone: "not a phone", code: "123456" },
    ]) {
      expect(await verifyLoginCode(demo, input, undefined)).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
    }
  });

  it("refuses even the correct demo code when demo OTP is not configured (D55, D69.12)", async () => {
    await makeRetailer(db, "R-A", "9999900101");
    expect(await verifyLoginCode(disabled, { phone: "9999900101", code: "123456" }, undefined)).toEqual({ ok: false, error: "LOGIN_DISABLED" });
    expect(await db.session.count()).toBe(0);
  });

  it("rotates the device's previous session on a new login", async () => {
    await makeRetailer(db, "R-A", "9999900101");
    const first = await verifyLoginCode(demo, { phone: "9999900101", code: "123456" }, undefined);
    if (!first.ok) throw new Error("expected login");
    const second = await verifyLoginCode(demo, { phone: "9999900101", code: "123456" }, first.token);
    if (!second.ok) throw new Error("expected login");
    expect(await findViewerByToken(db, first.token, NOW)).toBeNull();
    expect(await findViewerByToken(db, second.token, NOW)).not.toBeNull();
  });
});
