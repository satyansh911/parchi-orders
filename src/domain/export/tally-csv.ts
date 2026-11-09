// Tally sales-voucher CSV (D11, D29). Pure: the export service passes frozen
// order lines and stores the returned text. One row per order line.
//
// Contract (an assumption, see the TDD; not a native Tally XML import):
// - Voucher type "Sales", one voucher per order, voucher no = order number.
// - Date DD-MM-YYYY in IST (Asia/Kolkata), the order's placement date.
// - Party ledger = "<retailer code> <shop name>".
// - Sales ledger "Sales @ <rate>%", tax ledgers "Output CGST/SGST @ <half>%"
//   (intra-state, Madhya Pradesh). CGST = floor(GST/2), SGST = the rest, so
//   CGST + SGST = GST exactly.
// - Quantities in cases. Free goods are a separate column with no value.
// - Money in rupees with 2 decimals, no grouping: 1234.50.
// - Every row repeats the order total. Each order must reconcile:
//   sum(line totals) = order total, and taxable − discount + GST = line total.
// - Cells starting with = + - @ are prefixed with ' so spreadsheets don't run them.

export const TALLY_COLUMNS = [
  "Batch", "Voucher Type", "Voucher No", "Voucher Date", "Party Code", "Party Ledger", "Area",
  "Item Code", "Item Name", "Unit", "Paid Qty", "Free Qty", "Rate", "Taxable Value", "Discount %", "Discount",
  "Sales Ledger", "GST %", "CGST Ledger", "CGST", "SGST Ledger", "SGST", "Line Total", "Scheme", "Order Total",
] as const;

export type ExportLine = {
  skuCode: string; nameEn: string; paidCases: number; freeCases: number; casePricePaise: number;
  taxablePaise: number; discountBps: number; discountPaise: number; gstBps: number; gstPaise: number; lineTotalPaise: number;
  appliedLabel: string | null;
};
export type ExportOrder = {
  id: string; number: number; placedAt: Date; totalPaise: number;
  retailer: { code: string; shopName: string; area: string };
  lines: ExportLine[];
};
export type TallyCsv = { csv: string; orderCount: number; lineCount: number; totalPaise: number };

export class ExportMismatchError extends Error {
  constructor(readonly orderNumber: number, detail: string) {
    super(`order ${orderNumber} does not reconcile: ${detail}`);
    this.name = "ExportMismatchError";
  }
}

export const rupees = (paise: number) => `${paise < 0 ? "-" : ""}${Math.floor(Math.abs(paise) / 100)}.${String(Math.abs(paise) % 100).padStart(2, "0")}`;
const pct = (bps: number) => (bps % 100 === 0 ? String(bps / 100) : (bps / 100).toFixed(2).replace(/0$/, ""));

export function istDate(d: Date): string {
  const ist = new Date(d.getTime() + 330 * 60_000);
  return `${String(ist.getUTCDate()).padStart(2, "0")}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${ist.getUTCFullYear()}`;
}

export function csvCell(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Check every order before writing anything; a mismatch throws, so nothing is marked exported. */
export function reconcile(order: ExportOrder): void {
  if (order.lines.length === 0) throw new ExportMismatchError(order.number, "no lines");
  let sum = 0;
  for (const l of order.lines) {
    if (l.taxablePaise - l.discountPaise + l.gstPaise !== l.lineTotalPaise) throw new ExportMismatchError(order.number, `line ${l.skuCode}`);
    if (l.paidCases * l.casePricePaise !== l.taxablePaise) throw new ExportMismatchError(order.number, `taxable ${l.skuCode}`);
    sum += l.lineTotalPaise;
  }
  if (sum !== order.totalPaise) throw new ExportMismatchError(order.number, `lines ${sum} ≠ total ${order.totalPaise}`);
}

export function buildTallyCsv(batchNumber: number, orders: readonly ExportOrder[]): TallyCsv {
  const rows: string[] = [TALLY_COLUMNS.join(",")];
  let totalPaise = 0;
  let lineCount = 0;
  for (const order of [...orders].sort((a, b) => a.number - b.number)) {
    reconcile(order);
    totalPaise += order.totalPaise;
    for (const l of order.lines) {
      const cgst = Math.floor(l.gstPaise / 2);
      const half = pct(l.gstBps / 2);
      lineCount++;
      rows.push([
        batchNumber, "Sales", order.number, istDate(order.placedAt), order.retailer.code, `${order.retailer.code} ${order.retailer.shopName}`, order.retailer.area,
        l.skuCode, l.nameEn, "Case", l.paidCases, l.freeCases, rupees(l.casePricePaise), rupees(l.taxablePaise), pct(l.discountBps), rupees(l.discountPaise),
        `Sales @ ${pct(l.gstBps)}%`, pct(l.gstBps), `Output CGST @ ${half}%`, rupees(cgst), `Output SGST @ ${half}%`, rupees(l.gstPaise - cgst),
        rupees(l.lineTotalPaise), l.appliedLabel ?? "", rupees(order.totalPaise),
      ].map(csvCell).join(","));
    }
  }
  return { csv: rows.join("\r\n") + "\r\n", orderCount: orders.length, lineCount, totalPaise };
}
