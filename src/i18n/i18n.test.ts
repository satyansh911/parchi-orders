import { describe, expect, it } from "vitest";
import { en } from "./en";
import { formatBps, formatPaise, formatPaiseCompact } from "./format";
import { hi } from "./hi";
import { fromUserLocale, parseLocale, resolveLocale, toUserLocale } from "./locale";
import { translator } from "./messages";

describe("dictionaries", () => {
  it("have exactly the same keys in Hindi and English", () => {
    expect(Object.keys(hi).sort()).toEqual(Object.keys(en).sort());
  });

  it("have no empty strings", () => {
    for (const [key, value] of [...Object.entries(en), ...Object.entries(hi)]) expect(value.trim(), key).not.toBe("");
  });

  it("use the same {placeholders} in both languages", () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) expect(vars(hi[key]), key).toEqual(vars(en[key]));
  });

  it("actually translate the Hindi side (Devanagari, not copied English)", () => {
    expect(hi["nav.orders"]).toMatch(/[ऀ-ॿ]/);
    expect(hi["login.title"]).not.toBe(en["login.title"]);
  });
});

describe("translator", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(translator("en")("login.codeSentTo", { phone: "9999900101" })).toBe("Code sent to 9999900101");
    expect(translator("hi")("login.codeSentTo", { phone: "9999900101" })).toBe("कोड 9999900101 पर भेजा गया");
    expect(translator("en")("login.codeSentTo")).toBe("Code sent to {phone}");
  });
});

describe("locale precedence (D72)", () => {
  it("uses the device cookie before login", () => {
    expect(resolveLocale({ userLocale: null, cookie: "en" })).toBe("en");
    expect(resolveLocale({ userLocale: null, cookie: "hi" })).toBe("hi");
  });

  it("uses the saved account language after login, over the cookie", () => {
    expect(resolveLocale({ userLocale: "EN", cookie: "hi" })).toBe("en");
    expect(resolveLocale({ userLocale: "HI", cookie: "en" })).toBe("hi");
  });

  it("defaults to Hindi when there is no preference or the cookie is junk", () => {
    expect(resolveLocale({ userLocale: null, cookie: undefined })).toBe("hi");
    expect(resolveLocale({ userLocale: null, cookie: "fr" })).toBe("hi");
    expect(parseLocale("EN")).toBeNull();
  });

  it("maps between UI locales and the database enum", () => {
    expect(toUserLocale("en")).toBe("EN");
    expect(fromUserLocale(toUserLocale("hi"))).toBe("hi");
  });
});

describe("money formatting (D83)", () => {
  it.each([
    [0, "₹0.00"],
    [810, "₹8.10"],
    [77_760, "₹777.60"],
    [203_000, "₹2,030.00"],
    [1_161_769, "₹11,617.69"],
    [12_345_678, "₹1,23,456.78"],
    [1_000_000_000, "₹1,00,00,000.00"],
    [-30_450, "−₹304.50"],
  ])("formats %i paise as %s", (paise, text) => {
    expect(formatPaise(paise)).toBe(text);
  });

  it("drops .00 only in the compact form", () => {
    expect(formatPaiseCompact(1_000)).toBe("₹10");
    expect(formatPaiseCompact(1_050)).toBe("₹10.50");
  });

  it("rejects non-integer paise", () => {
    expect(() => formatPaise(8.1)).toThrow(RangeError);
  });

  it("formats basis points as percentages", () => {
    expect(formatBps(300)).toBe("3%");
    expect(formatBps(250)).toBe("2.5%");
    expect(formatBps(1800)).toBe("18%");
    expect(formatBps(1234)).toBe("12.34%");
  });
});
