import { describe, expect, it } from "vitest";
import { LOCAL_COOKIE_NAME, SECURE_COOKIE_NAME, isHttpsRequest, sessionCookieName, sessionCookieSettings } from "./cookie-config";

const NOW = new Date("2026-11-09T10:00:00Z");
const IN_7_DAYS = new Date("2026-11-16T10:00:00Z");

describe("session cookie over HTTPS on Vercel (D60, D70)", () => {
  const settings = sessionCookieSettings({ onVercel: true, forwardedProto: "https" }, IN_7_DAYS, NOW);

  it("uses __Host-parchi_session with Secure, HttpOnly, SameSite=Lax, Path=/", () => {
    expect(settings).toEqual({
      name: SECURE_COOKIE_NAME,
      options: { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 3600, expires: IN_7_DAYS },
    });
  });

  it("never sets a Domain attribute (required by the __Host- prefix)", () => {
    expect(settings.options).not.toHaveProperty("domain");
  });
});

describe("session cookie over local HTTP", () => {
  it("uses parchi_session without Secure, still HttpOnly and SameSite=Lax", () => {
    const settings = sessionCookieSettings({ onVercel: false, forwardedProto: null }, IN_7_DAYS, NOW);
    expect(settings.name).toBe(LOCAL_COOKIE_NAME);
    expect(settings.options).toMatchObject({ httpOnly: true, secure: false, sameSite: "lax", path: "/" });
    expect(settings.options).not.toHaveProperty("domain");
  });
});

describe("protocol detection does not trust client-supplied headers", () => {
  it("ignores x-forwarded-proto: https when not on Vercel (spoofable)", () => {
    expect(isHttpsRequest({ onVercel: false, forwardedProto: "https" })).toBe(false);
    expect(sessionCookieName({ onVercel: false, forwardedProto: "https" })).toBe(LOCAL_COOKIE_NAME);
  });

  it("on Vercel, uses Vercel's own (first) forwarded value", () => {
    expect(isHttpsRequest({ onVercel: true, forwardedProto: "https" })).toBe(true);
    expect(isHttpsRequest({ onVercel: true, forwardedProto: "HTTPS" })).toBe(true);
    expect(isHttpsRequest({ onVercel: true, forwardedProto: "https, http" })).toBe(true);
    expect(isHttpsRequest({ onVercel: true, forwardedProto: "http" })).toBe(false);
    expect(isHttpsRequest({ onVercel: true, forwardedProto: null })).toBe(false);
  });

  it("reads only the cookie name that matches the protocol", () => {
    expect(sessionCookieName({ onVercel: true, forwardedProto: "https" })).toBe(SECURE_COOKIE_NAME);
    expect(sessionCookieName({ onVercel: true, forwardedProto: "http" })).toBe(LOCAL_COOKIE_NAME);
  });

  it("never gives a negative max-age", () => {
    expect(sessionCookieSettings({ onVercel: false, forwardedProto: null }, NOW, IN_7_DAYS).options.maxAge).toBe(0);
  });
});
