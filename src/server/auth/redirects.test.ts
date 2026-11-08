import { describe, expect, it } from "vitest";
import { homeFor, safeNextPath } from "./redirects";

describe("homeFor", () => {
  it("sends retailers to the catalogue and the desk to the desk", () => {
    expect(homeFor("RETAILER")).toBe("/catalogue");
    expect(homeFor("DESK")).toBe("/desk");
  });
});

describe("safeNextPath: no open redirects (D68)", () => {
  it.each([
    ["/catalogue", "/catalogue"],
    ["/orders/abc123", "/orders/abc123"],
    ["/catalogue?category=tea", "/catalogue?category=tea"],
    ["/cart", "/cart"],
  ])("lets a retailer return to %s", (next, expected) => {
    expect(safeNextPath(next, "RETAILER")).toBe(expected);
  });

  it("lets the desk return to desk pages", () => {
    expect(safeNextPath("/desk/orders/abc", "DESK")).toBe("/desk/orders/abc");
  });

  it.each([
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "https://evil.example/catalogue",
    "http:/evil.example",
    "javascript:alert(1)",
    "evil.example/catalogue",
    "/catalogue\n/x",
    "/%2F%2Fevil.example",
    "",
  ])("ignores %j and goes home", (next) => {
    expect(safeNextPath(next, "RETAILER")).toBe("/catalogue");
  });

  it("never sends a user into the other role's area", () => {
    expect(safeNextPath("/desk", "RETAILER")).toBe("/catalogue");
    expect(safeNextPath("/catalogue/../desk", "RETAILER")).toBe("/catalogue");
    expect(safeNextPath("/catalogue", "DESK")).toBe("/desk");
    expect(safeNextPath("/deskfake", "DESK")).toBe("/desk");
  });

  it("ignores non-string and over-long values", () => {
    expect(safeNextPath(undefined, "RETAILER")).toBe("/catalogue");
    expect(safeNextPath(["/orders"], "RETAILER")).toBe("/catalogue");
    expect(safeNextPath(`/orders/${"x".repeat(600)}`, "RETAILER")).toBe("/catalogue");
  });
});
