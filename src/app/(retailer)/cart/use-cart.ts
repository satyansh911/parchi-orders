"use client";

import { useCallback, useSyncExternalStore } from "react";
import { emptyCart, parseCart, type CartState } from "./cart-state";

// The cart lives on this device, one per signed-in user (D12), so two people
// sharing a phone never see each other's cart. Tabs stay in sync via the
// "storage" event. If storage is blocked, the cart still works in memory.

const EVENT = "parchi-cart-change";
const keyFor = (userId: string) => `parchi_cart_v1_${userId}`;
const memory = new Map<string, string>();
const parsed = new Map<string, { raw: string | null; state: CartState }>();

export const newRequestId = () => crypto.randomUUID();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    memory.set(key, value);
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

function snapshot(key: string): CartState {
  const raw = read(key);
  const cached = parsed.get(key);
  if (cached && cached.raw === raw) return cached.state;
  const state = parseCart(raw, newRequestId);
  parsed.set(key, { raw, state });
  return state;
}

const SERVER_SNAPSHOT = emptyCart("server");

export function useCart(userId: string) {
  const key = keyFor(userId);
  const subscribe = useCallback(
    (notify: () => void) => {
      const onStorage = (e: StorageEvent) => e.key === key && notify();
      const onLocal = (e: Event) => (e as CustomEvent<string>).detail === key && notify();
      window.addEventListener("storage", onStorage);
      window.addEventListener(EVENT, onLocal);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(EVENT, onLocal);
      };
    },
    [key],
  );
  const cart = useSyncExternalStore(subscribe, () => snapshot(key), () => SERVER_SNAPSHOT);
  const update = useCallback((change: (s: CartState) => CartState) => {
    const current = snapshot(key);
    const next = change(current);
    if (next !== current) write(key, JSON.stringify(next));
  }, [key]);
  return { cart, update };
}
