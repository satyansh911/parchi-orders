// Order size limits (D45). Keeps every stored amount far inside the database's
// Int range (about ₹2.14 crore) and far above any real kirana order.

/** Paid cases on one line. */
export const MAX_CASES_PER_LINE = 999;
/** Lines on one order. */
export const MAX_LINES_PER_ORDER = 50;
/** ₹1 crore = 1,00,00,000 rupees = 1,00,00,00,000 paise. */
export const MAX_ORDER_TOTAL_PAISE = 1_000_000_000;
