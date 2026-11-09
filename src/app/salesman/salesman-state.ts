// Salesman phone state (D108): the downloaded pack, a cart per shop and the
// outbox of orders waiting to send. Pure functions; salesman-app.tsx stores
// the state in localStorage (one key per salesman) so it survives no signal,
// reloads and closing the browser.

import type { OfflineExpectation } from "@/domain/orders/offline-expectation";
import type { SalesmanPack } from "@/domain/salesman/pack";
import type { Pending } from "@/domain/salesman/price-offline";

export type OutboxStatus = "PENDING" | "SENDING" | "PLACED" | "CHANGED" | "NEEDS_EDIT" | "REJECTED";
export type OutboxEntry = {
  id: string; // clientRequestId: the same ID on every resend, so a lost response can't create a duplicate
  retailerId: string;
  shopName: string;
  lines: { skuId: string; paidCases: number }[];
  expected: OfflineExpectation;
  confirmCreditHold: boolean;
  takenAt: string;
  status: OutboxStatus;
  orderNumber?: number;
  syncedAt?: string;
  /** CHANGED: what the server would charge now; the salesman must confirm it. */
  newExpected?: OfflineExpectation;
};
export type Cart = Record<string, number>; // skuId → paid cases
export type SalesmanState = { v: 1; pack: SalesmanPack | null; carts: Record<string, Cart>; outbox: OutboxEntry[] };

export const emptyState = (): SalesmanState => ({ v: 1, pack: null, carts: {}, outbox: [] });
const MAX_CASES = 999;
const KEEP_SENT = 30;

export function parseState(raw: string | null): SalesmanState {
  if (!raw) return emptyState();
  try {
    const s = JSON.parse(raw) as SalesmanState;
    if (s?.v !== 1 || !Array.isArray(s.outbox) || typeof s.carts !== "object") return emptyState();
    return s;
  } catch {
    return emptyState();
  }
}

export function setCases(s: SalesmanState, shopId: string, skuId: string, cases: number): SalesmanState {
  const cart = { ...(s.carts[shopId] ?? {}) };
  const n = Math.max(0, Math.min(MAX_CASES, Math.floor(cases)));
  if (n === 0) delete cart[skuId];
  else cart[skuId] = n;
  return { ...s, carts: { ...s.carts, [shopId]: cart } };
}

export const cartLines = (cart: Cart | undefined) => Object.entries(cart ?? {}).map(([skuId, paidCases]) => ({ skuId, paidCases }));

/** Save the shop's cart as an outbox order and empty the cart. */
export function saveOrder(s: SalesmanState, entry: Omit<OutboxEntry, "status">): SalesmanState {
  const carts = { ...s.carts };
  delete carts[entry.retailerId];
  return { ...s, carts, outbox: [...s.outbox, { ...entry, status: "PENDING" }] };
}

export function updateEntry(s: SalesmanState, id: string, patch: Partial<OutboxEntry>): SalesmanState {
  const outbox = s.outbox.map((e) => (e.id === id ? { ...e, ...patch } : e));
  // Keep only the most recent sent orders as a receipt list.
  const sent = outbox.filter((e) => e.status === "PLACED");
  const drop = new Set(sent.slice(0, Math.max(0, sent.length - KEEP_SENT)).map((e) => e.id));
  return { ...s, outbox: outbox.filter((e) => !drop.has(e.id)) };
}

/** The salesman accepts the server's new total: resend with the same request ID. */
export const acceptNewTotal = (s: SalesmanState, id: string) => {
  const e = s.outbox.find((x) => x.id === id);
  return e?.newExpected ? updateEntry(s, id, { expected: e.newExpected, confirmCreditHold: e.newExpected.hold, newExpected: undefined, status: "PENDING" }) : s;
};

/** Back into the shop's cart for editing; the old entry is removed (nothing was placed). */
export function editEntry(s: SalesmanState, id: string): SalesmanState {
  const e = s.outbox.find((x) => x.id === id);
  if (!e || e.status === "PLACED" || e.status === "SENDING") return s;
  const cart: Cart = {};
  for (const l of e.lines) cart[l.skuId] = l.paidCases;
  return { ...s, carts: { ...s.carts, [e.retailerId]: cart }, outbox: s.outbox.filter((x) => x.id !== id) };
}

export const discardEntry = (s: SalesmanState, id: string): SalesmanState => ({ ...s, outbox: s.outbox.filter((x) => x.id !== id || x.status === "PLACED" || x.status === "SENDING") });

/**
 * Stock and credit already promised by orders not yet reflected in the pack:
 * everything unsent, plus sent orders placed after the pack was downloaded.
 */
export function pendingFor(s: SalesmanState, shopId: string): Pending {
  const packTime = s.pack ? Date.parse(s.pack.generatedAt) : 0;
  const counts = s.outbox.filter((e) => e.status !== "REJECTED" && (e.status !== "PLACED" || Date.parse(e.syncedAt ?? "") > packTime));
  const skuCases = new Map<string, number>();
  let shopPaise = 0;
  for (const e of counts) {
    for (const l of e.expected.lines) skuCases.set(l.skuId, (skuCases.get(l.skuId) ?? 0) + l.paidCases + l.freeCases);
    if (e.retailerId === shopId) shopPaise += e.expected.totalPaise;
  }
  return { skuCases, shopPaise };
}

export const toSend = (s: SalesmanState) => s.outbox.filter((e) => e.status === "PENDING");
