// Money display (D83): Latin digits with Indian grouping in both languages,
// from integer paise only. No floating-point division of money.

const GROUPING = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** 12345678 paise → "₹1,23,456.78". */
export function formatPaise(paise: number): string {
  if (!Number.isSafeInteger(paise)) throw new RangeError(`paise must be a safe integer, got ${paise}`);
  const sign = paise < 0 ? "−" : "";
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}₹${GROUPING.format(rupees)}.${rest}`;
}

/** For whole-rupee figures such as MRP badges: 1000 paise → "₹10", 1050 → "₹10.50". */
export function formatPaiseCompact(paise: number): string {
  const full = formatPaise(paise);
  return full.endsWith(".00") ? full.slice(0, -3) : full;
}

/** Basis points → "3%", "2.5%". */
export function formatBps(bps: number): string {
  const whole = Math.floor(bps / 100);
  const rest = bps % 100;
  return rest === 0 ? `${whole}%` : `${whole}.${String(rest).padStart(2, "0").replace(/0$/, "")}%`;
}
