import { describe, expect, it } from "vitest";
import type { Viewer } from "../auth/session-store";
import { ownedBy, targetRetailerId } from "./scope";

const retailerA: Viewer = { userId: "u1", sessionId: "s1", name: "A", role: "RETAILER", retailerId: "rA", locale: "HI" };
const desk: Viewer = { userId: "u2", sessionId: "s2", name: "D", role: "DESK", retailerId: null, locale: "EN" };
const code = (c: string) => expect.objectContaining({ code: c });

describe("ownedBy", () => {
  it("limits a retailer to their own retailerId from the session", () => {
    expect(ownedBy(retailerA)).toEqual({ retailerId: "rA" });
  });

  it("gives the desk everything", () => {
    expect(ownedBy(desk)).toEqual({});
  });

  it("refuses a retailer with no retailer link (never 'everything')", () => {
    expect(() => ownedBy({ ...retailerA, retailerId: null })).toThrow(code("NOT_FOUND"));
  });
});

describe("targetRetailerId", () => {
  it("is always the retailer's own id; naming another retailer is NOT_FOUND", () => {
    expect(targetRetailerId(retailerA, undefined)).toBe("rA");
    expect(targetRetailerId(retailerA, "rA")).toBe("rA");
    expect(() => targetRetailerId(retailerA, "rB")).toThrow(code("NOT_FOUND"));
  });

  it("requires the desk to name a retailer explicitly (D69.5)", () => {
    expect(targetRetailerId(desk, "rB")).toBe("rB");
    expect(() => targetRetailerId(desk, undefined)).toThrow(code("RETAILER_REQUIRED"));
    expect(() => targetRetailerId(desk, "")).toThrow(code("RETAILER_REQUIRED"));
  });
});
