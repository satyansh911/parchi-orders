"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { salesmanPackAction, syncSalesmanOrderAction } from "@/app/actions/salesman";
import { expectationOf } from "@/domain/orders/offline-expectation";
import { casePricePaise } from "@/domain/pricing/case-price";
import { inactivity, INACTIVE_AFTER_DAYS } from "@/domain/retailers/inactivity";
import { packSkuToCatalogue, type PackShop } from "@/domain/salesman/pack";
import { priceOfflineOrder } from "@/domain/salesman/price-offline";
import { fill } from "@/i18n/fill";
import { formatPaise } from "@/i18n/format";
import { Stepper } from "@/ui/stepper";
import {
  acceptNewTotal, cartLines, discardEntry, editEntry, emptyState, parseState, pendingFor, saveOrder, setCases, toSend, updateEntry,
  type OutboxEntry, type SalesmanState,
} from "./salesman-state";
import type { SalesmanStrings } from "./strings";

const keyFor = (userId: string) => `parchi_salesman_v1_${userId}`;
const SYNC_EVERY_MS = 30_000;

function load(userId: string): SalesmanState {
  try {
    return parseState(window.localStorage.getItem(keyFor(userId)));
  } catch {
    return emptyState();
  }
}

function useOnline() {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener("online", notify);
      window.addEventListener("offline", notify);
      return () => {
        window.removeEventListener("online", notify);
        window.removeEventListener("offline", notify);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

/** Register the service worker and ask it to keep this page and its scripts for offline use. */
function useOfflineShell() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").then(async () => {
      const reg = await navigator.serviceWorker.ready;
      const urls = [
        "/salesman",
        ...performance.getEntriesByType("resource").map((r) => r.name).filter((u) => u.startsWith(location.origin) && /\/_next\/static\//.test(u)),
      ];
      reg.active?.postMessage({ type: "CACHE_URLS", urls });
    }).catch(() => {});
  }, []);
}

export function SalesmanApp({ userId, locale, s }: { userId: string; locale: "hi" | "en"; s: SalesmanStrings }) {
  const [state, setState] = useState<SalesmanState>(emptyState);
  const [loaded, setLoaded] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const online = useOnline();
  const syncing = useRef(false);
  const stateRef = useRef(state);
  useOfflineShell();

  const update = useCallback((change: (s: SalesmanState) => SalesmanState) => {
    setState((current) => {
      const next = change(current);
      stateRef.current = next;
      try {
        window.localStorage.setItem(keyFor(userId), JSON.stringify(next));
      } catch {
        /* storage full or blocked: keep working in memory */
      }
      return next;
    });
  }, [userId]);

  useEffect(() => {
    // Read the phone's saved state after hydration (localStorage doesn't exist on the server).
    const t = setTimeout(() => {
      const initial = load(userId);
      stateRef.current = initial;
      setState(initial);
      setLoaded(true);
    }, 0);
    return () => clearTimeout(t);
  }, [userId]);

  const download = useCallback(async () => {
    setDownloading(true);
    try {
      const r = await salesmanPackAction({});
      if (r.ok) update((cur) => ({ ...cur, pack: r.data }));
    } catch {
      /* offline: keep the old pack */
    } finally {
      setDownloading(false);
    }
  }, [update]);

  const sync = useCallback(async () => {
    if (syncing.current || !navigator.onLine) return;
    syncing.current = true;
    let placedAny = false;
    try {
      for (const entry of toSend(stateRef.current)) {
        update((cur) => updateEntry(cur, entry.id, { status: "SENDING" }));
        try {
          const r = await syncSalesmanOrderAction({
            clientRequestId: entry.id, retailerId: entry.retailerId, lines: entry.lines, expected: entry.expected,
            confirmCreditHold: entry.confirmCreditHold, takenAt: entry.takenAt,
          });
          if (!r.ok) {
            update((cur) => updateEntry(cur, entry.id, { status: r.error === "UNAUTHENTICATED" ? "PENDING" : "REJECTED" }));
            if (r.error === "UNAUTHENTICATED") break;
            continue;
          }
          const d = r.data;
          if (d.outcome === "PLACED") {
            placedAny = true;
            update((cur) => updateEntry(cur, entry.id, { status: "PLACED", orderNumber: d.number, syncedAt: new Date().toISOString() }));
          } else if (d.outcome === "NOT_PLACED" && d.preview.problem === null) {
            // D108: price, scheme or credit changed: show the new total; he confirms before resending.
            const ok = d.preview.lines.flatMap((l) => (l.status === "OK" ? [{ skuId: l.skuId, ...l.line }] : []));
            update((cur) => updateEntry(cur, entry.id, { status: "CHANGED", newExpected: expectationOf(ok, d.preview.totals.totalPaise, d.preview.credit.hold) }));
          } else if (d.outcome === "NOT_PLACED") {
            update((cur) => updateEntry(cur, entry.id, { status: "NEEDS_EDIT" }));
          } else {
            update((cur) => updateEntry(cur, entry.id, { status: "REJECTED" }));
          }
        } catch {
          // Lost signal mid-send: try again later with the same request ID.
          update((cur) => updateEntry(cur, entry.id, { status: "PENDING" }));
          break;
        }
      }
    } finally {
      syncing.current = false;
    }
    if (placedAny) await download(); // fresh stock and credit after placing
  }, [update, download]);

  // Refresh the pack and send waiting orders whenever signal is available.
  useEffect(() => {
    if (!loaded || !online) return;
    const first = setTimeout(() => void download().then(sync), 0);
    const timer = setInterval(() => void sync(), SYNC_EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [loaded, online, download, sync]);

  const pack = state.pack;
  const shop = pack?.shops.find((x) => x.id === shopId) ?? null;
  const time = (iso: string) => new Date(iso).toLocaleString(locale === "hi" ? "hi-IN" : "en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  if (!loaded) return <div className="m-4 h-64 animate-pulse rounded-card bg-paper-dim" />;

  return (
    <main className="flex flex-col gap-4 px-4 pb-24 pt-3">
      <div role="status" className={`rounded-card p-3 text-sm ${online ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>
        {online ? s["sm.online"] : s["sm.offline"]}
        {pack && <span className="block text-xs text-ink-muted">{fill(s["sm.updated"], { time: time(pack.generatedAt) })} · {s["sm.ready"]}</span>}
      </div>
      {!pack ? (
        <div className="flex flex-col gap-3 rounded-card border border-line p-4">
          <p>{s["sm.noPack"]}</p>
          <button type="button" disabled={!online || downloading} onClick={() => void download()} className="min-h-14 rounded-card bg-accent text-lg font-semibold text-paper disabled:opacity-50">
            {downloading ? s["sm.refreshing"] : s["sm.download"]}
          </button>
        </div>
      ) : shop ? (
        <ShopView
          shop={shop} state={state} s={s} onBack={() => setShopId(null)}
          onCases={(skuId, n) => update((cur) => setCases(cur, shop.id, skuId, n))}
          onSave={(entry) => {
            update((cur) => saveOrder(cur, entry));
            setNotice(s["sm.saved"]);
            setShopId(null);
            void sync();
          }}
        />
      ) : (
        <>
          {notice && <p role="status" className="rounded-card bg-accent-soft p-3 text-sm text-accent-strong">{notice}</p>}
          <Outbox state={state} s={s} online={online} time={time} onSend={() => void sync()}
            onAccept={(id) => { update((cur) => acceptNewTotal(cur, id)); void sync(); }}
            onEdit={(id, retailerId) => { update((cur) => editEntry(cur, id)); setShopId(retailerId); }}
            onDiscard={(id) => update((cur) => discardEntry(cur, id))} />
          <ShopList shops={pack.shops} s={s} onOpen={(id) => { setNotice(null); setShopId(id); }} />
        </>
      )}
    </main>
  );
}

function ShopList({ shops, s, onOpen }: { shops: PackShop[]; s: SalesmanStrings; onOpen: (id: string) => void }) {
  const [onlyInactive, setOnlyInactive] = useState(false);
  const now = useMemo(() => new Date(), []);
  const rows = shops.map((shop) => ({ shop, ...inactivity(shop.lastOrderAt ? new Date(shop.lastOrderAt) : null, now) }));
  const shown = onlyInactive ? rows.filter((r) => r.inactive) : rows;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{s["sm.shops"]}</h1>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyInactive} onChange={(e) => setOnlyInactive(e.target.checked)} className="h-5 w-5" />
          {s["sm.onlyInactive"]}
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-card bg-paper-dim p-4 text-center text-ink-muted">{s["sm.noShops"]}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map(({ shop, inactive, daysSince }) => (
            <li key={shop.id} className="flex items-center gap-2 rounded-card border border-line p-3">
              <button type="button" onClick={() => onOpen(shop.id)} className="min-h-12 min-w-0 flex-1 text-left">
                <p className="truncate font-semibold">{shop.shopName}</p>
                <p className="text-sm text-ink-muted">{shop.area} · {shop.credit.alreadyOverPaise > 0 ? fill(s["sm.creditOver"], { amount: formatPaise(shop.credit.alreadyOverPaise) }) : fill(s["sm.credit"], { amount: formatPaise(shop.credit.availablePaise) })}</p>
                {inactive && <p className="text-sm font-medium text-warn">{daysSince === null ? s["sm.never"] : fill(s["sm.inactive"], { n: daysSince })}</p>}
              </button>
              {shop.phone && <a href={`tel:+91${shop.phone}`} className="flex min-h-11 items-center rounded-card border border-line px-3 text-sm text-accent">{s["sm.call"]}</a>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink-muted">{fill(s["sm.inactive"], { n: INACTIVE_AFTER_DAYS })}+ → {s["sm.onlyInactive"]}</p>
    </section>
  );
}

function ShopView({ shop, state, s, onBack, onCases, onSave }: {
  shop: PackShop; state: SalesmanState; s: SalesmanStrings; onBack: () => void;
  onCases: (skuId: string, n: number) => void; onSave: (entry: Omit<OutboxEntry, "status">) => void;
}) {
  const [query, setQuery] = useState("");
  const [holdOk, setHoldOk] = useState(false);
  const pack = state.pack!;
  const cart = state.carts[shop.id] ?? {};
  const lines = cartLines(cart);
  const pending = pendingFor(state, shop.id);
  const now = new Date();
  const priced = priceOfflineOrder(pack.skus, shop, lines, pending, now);
  const byLine = new Map(priced.lines.map((l) => [l.skuId, l]));
  const q = query.trim().toLowerCase();
  const skus = pack.skus.filter((k) => !q || `${k.nameEn} ${k.nameHi} ${k.brand} ${k.categoryEn}`.toLowerCase().includes(q));
  const canSave = priced.expectation !== null && (!priced.credit.hold || holdOk);

  return (
    <section className="flex flex-col gap-3">
      <button type="button" onClick={onBack} className="min-h-11 self-start text-sm text-accent">← {s["sm.back"]}</button>
      <div>
        <h1 className="text-xl font-semibold">{shop.shopName}</h1>
        <p className="text-sm text-ink-muted">{shop.code} · {shop.area} · {shop.tierName} · {fill(s["sm.credit"], { amount: formatPaise(Math.max(0, priced.credit.availablePaise)) })}</p>
      </div>
      <label className="sr-only" htmlFor="sm-search">{s["sm.search"]}</label>
      <input id="sm-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={s["sm.search"]} className="min-h-12 rounded-card border border-line px-3" />
      <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
        {skus.map((k) => {
          const inCart = cart[k.id] ?? 0;
          const l = byLine.get(k.id);
          const out = k.availableCases - (pending.skuCases.get(k.id) ?? 0) <= 0;
          return (
            <li key={k.id} className="flex items-center justify-between gap-3 p-3" data-testid="sm-sku">
              <div className="min-w-0">
                <p className="font-medium">{k.nameHi} · {k.packSize}</p>
                <p className="text-sm"><span className="font-semibold">{formatPaise(casePricePaise(packSkuToCatalogue(k), shop.tierDiscountBps))}</span> <span className="text-ink-muted">{s["sm.perCase"]}</span></p>
                {k.schemes[0] && <p className="text-xs text-accent">{k.schemes.map((x) => x.labelHi || x.labelEn).join(" · ")}</p>}
                {out && !inCart && <p className="text-xs text-danger">{s["sm.outOfStock"]}</p>}
                {l?.status === "OK" && l.line.freeCases > 0 && <p className="text-xs font-medium text-ok">{fill(s["sm.free"], { n: l.line.freeCases })}</p>}
                {l?.status === "STOCK_SHORT" && <p className="text-xs text-danger">{fill(s["sm.stockShort"], { n: l.maxPaidCases })}</p>}
                {l?.status === "OUT_OF_STOCK" && <p className="text-xs text-danger">{s["sm.outOfStock"]}</p>}
              </div>
              <Stepper value={inCart} disabled={out && !inCart} onIncrease={() => onCases(k.id, inCart + 1)} onDecrease={() => onCases(k.id, inCart - 1)}
                addLabel={s["cart.add"]} increaseLabel={s["cart.increase"]} decreaseLabel={s["cart.decrease"]} quantityLabel={s["cart.quantity"]} />
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-line bg-paper py-3">
        {lines.length === 0 ? (
          <p className="text-sm text-ink-muted">{s["sm.empty"]}</p>
        ) : (
          <>
            {priced.totals.discountPaise > 0 && <p className="flex justify-between text-sm"><span>{s["sm.discount"]}</span><span>− {formatPaise(priced.totals.discountPaise)}</span></p>}
            <p className="flex justify-between font-semibold"><span>{s["sm.total"]}</span><span className="tabular-nums">{formatPaise(priced.totals.totalPaise)}</span></p>
            {priced.credit.hold && (
              <label className="flex items-start gap-2 rounded-card bg-warn-soft p-2 text-sm text-warn">
                <input type="checkbox" checked={holdOk} onChange={(e) => setHoldOk(e.target.checked)} className="mt-0.5 h-5 w-5" />
                <span>{fill(s["sm.holdWarn"], { amount: formatPaise(priced.credit.overByPaise) })} {s["sm.holdConfirm"]}</span>
              </label>
            )}
          </>
        )}
        <button type="button" disabled={!canSave} className="min-h-14 rounded-card bg-accent text-lg font-semibold text-paper disabled:bg-paper-dim disabled:text-ink-faint"
          onClick={() => priced.expectation && onSave({
            id: crypto.randomUUID(), retailerId: shop.id, shopName: shop.shopName, lines, expected: priced.expectation,
            confirmCreditHold: priced.credit.hold, takenAt: new Date().toISOString(),
          })}>
          {fill(s["sm.save"], { amount: formatPaise(priced.totals.totalPaise) })}
        </button>
      </div>
    </section>
  );
}

function Outbox({ state, s, online, time, onSend, onAccept, onEdit, onDiscard }: {
  state: SalesmanState; s: SalesmanStrings; online: boolean; time: (iso: string) => string; onSend: () => void;
  onAccept: (id: string) => void; onEdit: (id: string, retailerId: string) => void; onDiscard: (id: string) => void;
}) {
  if (state.outbox.length === 0) return null;
  const waiting = state.outbox.some((e) => e.status === "PENDING");
  const tone: Record<OutboxEntry["status"], string> = { PENDING: "text-warn", SENDING: "text-ink-muted", PLACED: "text-ok", CHANGED: "text-warn", NEEDS_EDIT: "text-danger", REJECTED: "text-danger" };
  return (
    <section className="flex flex-col gap-2" aria-label={s["sm.outbox"]}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{s["sm.outbox"]}</h2>
        {waiting && online && <button type="button" onClick={onSend} className="min-h-11 rounded-card border border-accent px-3 text-sm text-accent">{s["sm.sendNow"]}</button>}
      </div>
      <ul className="flex flex-col gap-2">
        {[...state.outbox].reverse().map((e) => (
          <li key={e.id} className="flex flex-col gap-2 rounded-card border border-line p-3" data-testid="sm-outbox-entry">
            <div className="flex justify-between gap-2">
              <p className="font-medium">{e.shopName}</p>
              <p className="tabular-nums">{formatPaise(e.expected.totalPaise)}</p>
            </div>
            <p className="text-xs text-ink-muted">{fill(s["sm.items"], { n: e.lines.length })} · {fill(s["sm.takenAt"], { time: time(e.takenAt) })}</p>
            <p className={`text-sm font-medium ${tone[e.status]}`}>
              {fill(s[`sm.st.${e.status}`], { n: e.orderNumber ?? "", amount: formatPaise(e.newExpected?.totalPaise ?? 0) })}
            </p>
            {(e.status === "CHANGED" || e.status === "NEEDS_EDIT" || e.status === "REJECTED") && (
              <div className="flex flex-wrap gap-2">
                {e.status === "CHANGED" && <button type="button" onClick={() => onAccept(e.id)} className="min-h-11 rounded-card bg-accent px-3 text-sm font-semibold text-paper">{s["sm.resend"]}</button>}
                {e.status !== "REJECTED" && <button type="button" onClick={() => onEdit(e.id, e.retailerId)} className="min-h-11 rounded-card border border-accent px-3 text-sm text-accent">{s["sm.edit"]}</button>}
                <button type="button" onClick={() => onDiscard(e.id)} className="min-h-11 px-3 text-sm text-danger">{s["sm.discard"]}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
