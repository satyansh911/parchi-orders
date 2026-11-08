// Cart state (D12, D16, D48, D76, D78). Pure functions only; the hook in
// use-cart.ts stores it in localStorage, one cart per signed-in user.
// Prices are never stored here: the server prices the cart (D74).

export const MAX_CASES = 999;
export const MAX_LINES = 50;

export type OfferChoice = "BEST" | "WITHOUT_FREE_GOODS";
export type CartLine = { skuId: string; paidCases: number; choice?: OfferChoice };

/** A placement whose outcome isn't known yet (D76): ID and exact payload are kept. */
export type PendingSubmission = { requestId: string; lines: CartLine[]; quote: string; confirmCreditHold: boolean; startedAt: number };

export type CartState = { v: 1; requestId: string; lines: CartLine[]; pending: PendingSubmission | null };

export const emptyCart = (requestId: string): CartState => ({ v: 1, requestId, lines: [], pending: null });

/** While a submission is pending the cart is locked: it must be resolved first (D76). */
export const isLocked = (s: CartState) => s.pending !== null;

const clampCases = (n: number) => Math.max(0, Math.min(MAX_CASES, Math.floor(n)));

export function casesFor(s: CartState, skuId: string): number {
  return s.lines.find((l) => l.skuId === skuId)?.paidCases ?? 0;
}

/** Set a line's paid cases; 0 removes it. A manual change drops any offer choice. */
export function setCases(s: CartState, skuId: string, paidCases: number): CartState {
  if (isLocked(s)) return s;
  const n = clampCases(paidCases);
  const exists = s.lines.some((l) => l.skuId === skuId);
  if (n === 0) return { ...s, lines: s.lines.filter((l) => l.skuId !== skuId) };
  if (exists) return { ...s, lines: s.lines.map((l) => (l.skuId === skuId ? { skuId, paidCases: n } : l)) };
  if (s.lines.length >= MAX_LINES) return s;
  return { ...s, lines: [...s.lines, { skuId, paidCases: n }] };
}

export const addCase = (s: CartState, skuId: string) => setCases(s, skuId, casesFor(s, skuId) + 1);
export const removeCase = (s: CartState, skuId: string) => setCases(s, skuId, casesFor(s, skuId) - 1);
export const removeLine = (s: CartState, skuId: string) => setCases(s, skuId, 0);

/** The retailer explicitly picked a stock option (D18, D42, D51). */
export function chooseOption(s: CartState, skuId: string, paidCases: number, choice: OfferChoice): CartState {
  if (isLocked(s)) return s;
  const n = clampCases(paidCases);
  if (n === 0) return removeLine(s, skuId);
  return { ...s, lines: s.lines.map((l) => (l.skuId === skuId ? (choice === "BEST" ? { skuId, paidCases: n } : { skuId, paidCases: n, choice }) : l)) };
}

/** "Order again" (D9, D78): replace the cart, or add, summing cases per SKU (capped). */
export function mergeLines(s: CartState, incoming: CartLine[], mode: "replace" | "add"): CartState {
  if (isLocked(s)) return s;
  let next: CartState = mode === "replace" ? { ...s, lines: [] } : s;
  for (const line of incoming) next = setCases(next, line.skuId, casesFor(next, line.skuId) + line.paidCases);
  return next;
}

export function startSubmission(s: CartState, quote: string, confirmCreditHold: boolean, now: number): CartState {
  if (isLocked(s) || s.lines.length === 0) return s;
  return { ...s, pending: { requestId: s.requestId, lines: s.lines, quote, confirmCreditHold, startedAt: now } };
}

/** Resolved with nothing created (e.g. quote changed): unlock and use a fresh ID next time (D76). */
export function resolveNotCreated(s: CartState, newRequestId: string): CartState {
  return { ...s, pending: null, requestId: newRequestId };
}

/** Resolved with an order (new or already placed): empty cart, fresh ID (D76). */
export function resolvePlaced(newRequestId: string): CartState {
  return emptyCart(newRequestId);
}

/** Parse stored JSON defensively; anything unexpected becomes an empty cart. */
export function parseCart(raw: string | null, newRequestId: () => string): CartState {
  if (!raw) return emptyCart(newRequestId());
  try {
    const data = JSON.parse(raw) as Partial<CartState>;
    if (data?.v !== 1 || typeof data.requestId !== "string" || !Array.isArray(data.lines)) return emptyCart(newRequestId());
    const lines = data.lines
      .filter((l): l is CartLine => typeof l?.skuId === "string" && Number.isInteger(l.paidCases) && l.paidCases >= 1 && l.paidCases <= MAX_CASES)
      .slice(0, MAX_LINES);
    const unique = lines.filter((l, i) => lines.findIndex((m) => m.skuId === l.skuId) === i);
    const pending = data.pending && typeof data.pending.requestId === "string" && typeof data.pending.quote === "string" ? data.pending : null;
    return { v: 1, requestId: data.requestId, lines: unique, pending };
  } catch {
    return emptyCart(newRequestId());
  }
}
