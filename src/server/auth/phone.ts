// Indian mobile number input (D63). Accepts how people actually type numbers
// ("+91 99999 00101", "099999 00101", "91-99999-00101") and returns the one
// canonical stored form: 10 digits starting with 6–9. Anything else is null.

const CANONICAL = /^[6-9]\d{9}$/;

export function normalisePhone(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 20) return null;
  if (!/^[\d\s+()-]+$/.test(input)) return null;

  let digits = input.replace(/[\s()-]/g, "");
  if (digits.startsWith("+")) {
    if (!digits.startsWith("+91")) return null;
    digits = digits.slice(3);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return CANONICAL.test(digits) ? digits : null;
}
