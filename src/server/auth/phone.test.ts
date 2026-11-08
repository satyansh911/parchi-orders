import { describe, expect, it } from "vitest";
import { normalisePhone } from "./phone";

describe("normalisePhone (D63)", () => {
  it.each([
    ["9999900101", "9999900101"],
    ["99999 00101", "9999900101"],
    ["+91 99999 00101", "9999900101"],
    ["+919999900101", "9999900101"],
    ["919999900101", "9999900101"],
    ["09999900101", "9999900101"],
    ["+91-99999-00101", "9999900101"],
    ["(+91) 99999 00101", "9999900101"],
    ["6000000000", "6000000000"],
  ])("accepts %s as %s", (input, expected) => {
    expect(normalisePhone(input)).toBe(expected);
  });

  it.each([
    "5999900101", // must start 6–9
    "999990010", // 9 digits
    "99999001011", // 11 digits, not a leading 0
    "+1 9999900101", // other country code
    "+9199999001", // +91 but too short
    "00919999900101",
    "99999OO101", // letters
    "9999900101; DROP TABLE",
    "",
    " ",
    "+",
    "1".repeat(50),
  ])("rejects %s", (input) => {
    expect(normalisePhone(input)).toBeNull();
  });

  it("rejects non-strings", () => {
    for (const bad of [undefined, null, 9999900101, {}, []]) expect(normalisePhone(bad)).toBeNull();
  });
});
