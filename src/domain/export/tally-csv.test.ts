import { describe, expect, it } from "vitest";
import { buildTallyCsv, csvCell, ExportMismatchError, istDate, rupees, TALLY_COLUMNS, type ExportOrder } from "./tally-csv";

// Detergent 5 cases at the STANDARD tier with the 3% slab (C.16).
const detergent = { skuCode: "SKU-DT-1KG", nameEn: "Detergent powder 1 kg", paidCases: 5, freeCases: 0, casePricePaise: 203_000, taxablePaise: 1_015_000, discountBps: 300, discountPaise: 30_450, gstBps: 1800, gstPaise: 177_219, lineTotalPaise: 1_161_769, appliedLabel: "3% off 5 or more cases" };
// Biscuit 10 cases + 1 free (Buy 10 get 1).
const biscuit = { skuCode: "SKU-BS-075", nameEn: "Glucose biscuit 75 g", paidCases: 10, freeCases: 1, casePricePaise: 77_760, taxablePaise: 777_600, discountBps: 0, discountPaise: 0, gstBps: 500, gstPaise: 38_880, lineTotalPaise: 816_480, appliedLabel: "Buy 10 cases get 1 free" };
const order = (over: Partial<ExportOrder> = {}): ExportOrder => ({
  id: "o1", number: 42, placedAt: new Date("2026-11-09T20:00:00Z"), totalPaise: 1_978_249,
  retailer: { code: "R-0001", shopName: "Gupta Kirana, Sadar", area: "Sadar" }, lines: [detergent, biscuit], ...over,
});

describe("Tally CSV (D29)", () => {
  it("writes the documented columns, one row per line, with free goods and the CGST/SGST split", () => {
    const out = buildTallyCsv(7, [order()]);
    const rows = out.csv.trimEnd().split("\r\n");
    expect(rows[0]).toBe(TALLY_COLUMNS.join(","));
    expect(rows).toHaveLength(3);
    expect(rows[1]).toBe('7,Sales,42,10-11-2026,R-0001,"R-0001 Gupta Kirana, Sadar",Sadar,SKU-DT-1KG,Detergent powder 1 kg,Case,5,0,2030.00,10150.00,3,304.50,Sales @ 18%,18,Output CGST @ 9%,886.09,Output SGST @ 9%,886.10,11617.69,3% off 5 or more cases,19782.49');
    expect(rows[2]).toContain(",Case,10,1,777.60,7776.00,0,0.00,Sales @ 5%,5,Output CGST @ 2.5%,194.40,Output SGST @ 2.5%,194.40,8164.80,");
    expect(out).toMatchObject({ orderCount: 1, lineCount: 2, totalPaise: 1_978_249 });
  });

  it("uses the IST date (20:00 UTC on 9 Nov is 10 Nov in India)", () => {
    expect(istDate(new Date("2026-11-09T18:29:59Z"))).toBe("09-11-2026");
    expect(istDate(new Date("2026-11-09T18:30:00Z"))).toBe("10-11-2026");
  });

  it("sorts vouchers by order number and sums the batch", () => {
    const out = buildTallyCsv(1, [order({ id: "b", number: 50 }), order({ id: "a", number: 43 })]);
    const numbers = out.csv.trimEnd().split("\r\n").slice(1).map((r) => r.split(",")[2]);
    expect(numbers).toEqual(["43", "43", "50", "50"]);
    expect(out.totalPaise).toBe(2 * 1_978_249);
  });

  it("refuses an order that doesn't reconcile, so nothing is exported", () => {
    expect(() => buildTallyCsv(1, [order({ totalPaise: 1 })])).toThrow(ExportMismatchError);
    expect(() => buildTallyCsv(1, [order({ lines: [{ ...detergent, gstPaise: 1 }] , totalPaise: detergent.lineTotalPaise })])).toThrow(ExportMismatchError);
    expect(() => buildTallyCsv(1, [order({ lines: [], totalPaise: 0 })])).toThrow(ExportMismatchError);
  });

  it("escapes quotes and commas, and neutralises spreadsheet formulas", () => {
    expect(csvCell('He said "hi", ok')).toBe('"He said ""hi"", ok"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-12.50")).toBe("-12.50");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });

  it("formats paise as rupees with two decimals", () => {
    expect([rupees(0), rupees(5), rupees(123_456), rupees(-250)]).toEqual(["0.00", "0.05", "1234.56", "-2.50"]);
  });
});
