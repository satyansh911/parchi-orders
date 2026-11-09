"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { previewCartAction } from "@/app/actions/cart";
import { placeOrderAction } from "@/app/actions/orders";
import { fill } from "@/i18n/fill";
import { formatBps, formatPaise } from "@/i18n/format";
import type { Locale } from "@/i18n/messages";
import type { CartLineResult, CartPreview, LineView, OfferView } from "@/server/cart/price-cart";
import type { NotPlacedProblem, PlaceOrderResult } from "@/server/orders/place-order";
import { PackImage } from "@/ui/pack-image";
import { Stepper } from "@/ui/stepper";
import {
  addCase, casesFor, chooseOption, isLocked, removeCase, removeLine, resolveNotCreated, resolvePlaced, setCases, startSubmission,
  type CartState, type PendingSubmission,
} from "./cart-state";
import type { CartStrings } from "./strings";
import { newRequestId, useCart } from "./use-cart";

const DEBOUNCE_MS = 350;

/**
 * The cart is priced on the server (D74). Previews are debounced, and only the
 * response for the LATEST cart is ever shown (D90): results are kept with the
 * exact cart they priced, so a slow, older response can never overwrite a newer one.
 *
 * Placing (D76): the exact payload and request ID are saved and the cart is
 * locked. If the answer is lost, the SAME request is sent again (on "Try
 * again" or when the page is reopened) until the server says what happened.
 */
export function CartView({ userId, locale, s }: { userId: string; locale: Locale; s: CartStrings }) {
  const { cart, update } = useCart(userId);
  const router = useRouter();
  const cartKey = JSON.stringify(cart.lines);
  const latest = useRef(0);
  const inFlight = useRef(false);
  const [result, setResult] = useState<{ key: string; preview: CartPreview } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [retries, setRetries] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  // Tied to the cart they were about: Next keeps this page mounted (hidden)
  // between visits, so a message must not outlive the cart it describes.
  const [problemFor, setProblemFor] = useState<{ key: string; problem: NotPlacedProblem | "REJECTED" } | null>(null);
  const [placed, setPlaced] = useState<Extract<PlaceOrderResult, { outcome: "PLACED" }> | null>(null);

  useEffect(() => {
    if (cart.lines.length === 0) return;
    const request = ++latest.current;
    const lines = cart.lines;
    const timer = setTimeout(async () => {
      try {
        const response = await previewCartAction({ lines });
        if (request !== latest.current) return; // a newer cart was requested: drop this one (D90)
        if (!response.ok) {
          if (response.error === "UNAUTHENTICATED") return router.push("/login?next=%2Fcart");
          return setFailedKey(cartKey);
        }
        setResult({ key: cartKey, preview: response.data });
        setFailedKey(null);
      } catch {
        if (request === latest.current) setFailedKey(cartKey);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // cartKey captures the lines; retries re-runs after an error.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, retries]);

  async function submit(pending: PendingSubmission) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setUnconfirmed(false);
    try {
      const response = await placeOrderAction({
        clientRequestId: pending.requestId,
        lines: pending.lines,
        quote: pending.quote,
        confirmCreditHold: pending.confirmCreditHold,
      });
      if (!response.ok) {
        if (response.error === "UNAUTHENTICATED") return router.push("/login?next=%2Fcart");
        // Refused before anything was created: unlock with a fresh ID (D76).
        update((c) => resolveNotCreated(c, newRequestId()));
        return setProblemFor({ key: JSON.stringify(pending.lines), problem: "REJECTED" });
      }
      const outcome = response.data;
      if (outcome.outcome === "PLACED") {
        update(() => resolvePlaced(newRequestId()));
        setPlaced(outcome);
      } else if (outcome.outcome === "NOT_PLACED") {
        update((c) => resolveNotCreated(c, newRequestId()));
        setResult({ key: JSON.stringify(pending.lines), preview: outcome.preview }); // show what changed
        setProblemFor({ key: JSON.stringify(pending.lines), problem: outcome.problem });
      } else {
        update((c) => resolveNotCreated(c, newRequestId()));
        setProblemFor({ key: JSON.stringify(pending.lines), problem: "REJECTED" });
      }
    } catch {
      setUnconfirmed(true); // outcome unknown: keep the pending request and its ID (D76)
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  // Reopened with an unresolved submission: resolve that exact request first (D76).
  useEffect(() => {
    const pending = cart.pending;
    if (!pending || placed) return;
    const timer = setTimeout(() => void submit(pending), 0); // scheduled, not a synchronous state update in the effect
    return () => clearTimeout(timer);
    // Only when a pending submission appears (e.g. on load).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.pending?.requestId]);

  function start(confirmCreditHold: boolean) {
    const quote = fresh?.quote;
    if (!quote || isLocked(cart)) return;
    setConfirming(false);
    setProblemFor(null);
    update((c) => startSubmission(c, quote, confirmCreditHold, Date.now()));
  }

  // Shown only until the retailer starts a new cart (e.g. "Order again").
  if (placed && cart.lines.length === 0) return <PlacedPanel placed={placed} s={s} />;
  const problem = problemFor && problemFor.key === cartKey ? problemFor.problem : null;

  if (cart.lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        {problemFor?.problem === "REJECTED" && <p role="alert" className="text-sm text-danger">{s["cart.problem.REJECTED"]}</p>}
        <p className="text-ink-muted">{s["cart.empty"]}</p>
        <Link href="/catalogue" className="flex min-h-12 items-center rounded-card bg-accent px-6 font-semibold text-paper">{s["cart.browse"]}</Link>
      </div>
    );
  }

  const locked = isLocked(cart);
  const failed = failedKey === cartKey;
  const fresh = result?.key === cartKey ? result.preview : null;
  const shown = result?.preview ?? null; // last good preview, possibly for an older cart
  const updating = !fresh && !failed;
  const canPlace = !!fresh?.quote && fresh.problem === null && !locked && !submitting;

  return (
    <div className="flex flex-col gap-4 py-3">
      <p className="text-xs text-ink-muted">{s["cart.priceNote"]}</p>
      <p aria-live="polite" className="min-h-5 text-sm text-accent">
        {submitting || locked ? s["cart.placing"] : updating ? (shown ? s["cart.updating"] : s["cart.loading"]) : ""}
      </p>
      {problem && problem !== "REJECTED" && <p role="alert" className="rounded-card border border-warn/50 bg-warn-soft p-3 text-sm font-medium">{s[`cart.problem.${problem}`]}</p>}
      {problem === "REJECTED" && <p role="alert" className="rounded-card border border-danger/40 bg-danger-soft p-3 text-sm">{s["cart.problem.REJECTED"]}</p>}
      {failed && !locked && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-danger/40 bg-danger-soft p-3 text-sm">
          <span>{s["cart.previewError"]}</span>
          <button type="button" onClick={() => setRetries((n) => n + 1)} className="min-h-11 rounded-full border border-danger px-4 font-medium text-danger">{s["cart.retry"]}</button>
        </div>
      )}
      {unconfirmed && cart.pending && (
        <div role="alert" className="flex flex-col gap-2 rounded-card border border-danger/40 bg-danger-soft p-3 text-sm">
          <span>{s["cart.unconfirmed"]}</span>
          <button type="button" disabled={submitting} onClick={() => cart.pending && submit(cart.pending)} className="min-h-12 rounded-card border border-danger font-medium text-danger disabled:opacity-60">{s["cart.retry"]}</button>
        </div>
      )}

      <ul className={`flex flex-col gap-3 transition-opacity ${updating && shown ? "opacity-60" : ""}`}>
        {cart.lines.map((line) => {
          const priced = shown?.lines.find((l) => l.skuId === line.skuId);
          return priced ? (
            <CartLineCard key={line.skuId} result={priced} cases={casesFor(cart, line.skuId)} locked={locked} locale={locale} s={s} update={update} />
          ) : (
            <li key={line.skuId} className="h-28 animate-pulse rounded-card border border-line bg-paper-dim" />
          );
        })}
      </ul>

      {shown && <Totals preview={shown} s={s} />}
      {shown && <CreditPanel preview={shown} s={s} />}
      {fresh?.problem === "LINES_NEED_ATTENTION" && <p role="alert" className="text-sm font-medium text-warn">{s["cart.fixLines"]}</p>}
      {fresh?.problem === "ORDER_TOO_LARGE" && <p role="alert" className="text-sm font-medium text-danger">{s["cart.tooLarge"]}</p>}

      {confirming && fresh?.credit.hold ? (
        <section role="alertdialog" aria-labelledby="hold-title" aria-describedby="hold-body" className="flex flex-col gap-3 rounded-card border-2 border-warn bg-warn-soft p-4">
          <h2 id="hold-title" className="font-semibold">{s["cart.confirmHold.title"]}</h2>
          <p id="hold-body" className="text-sm">{fill(s["cart.confirmHold.body"], { amount: formatPaise(fresh.credit.overByPaise) })}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="min-h-12 flex-1 rounded-card border border-line bg-paper font-medium">{s["cart.confirmHold.no"]}</button>
            <button type="button" onClick={() => start(true)} className="min-h-12 flex-1 rounded-card bg-warn font-semibold text-paper">{s["cart.confirmHold.yes"]}</button>
          </div>
        </section>
      ) : (
        <div className="sticky bottom-16 z-10 -mx-4 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur">
          <button
            type="button"
            disabled={!canPlace}
            onClick={() => (fresh?.credit.hold ? setConfirming(true) : start(false))}
            className="flex min-h-14 w-full items-center justify-between rounded-card bg-accent px-5 text-lg font-semibold text-paper disabled:bg-paper-dim disabled:text-ink-faint"
          >
            <span>{submitting || locked ? s["cart.placing"] : s["cart.place"]}</span>
            {fresh && <span className="tabular-nums">{formatPaise(fresh.totals.totalPaise)}</span>}
          </button>
        </div>
      )}
    </div>
  );
}

function PlacedPanel({ placed, s }: { placed: Extract<PlaceOrderResult, { outcome: "PLACED" }>; s: CartStrings }) {
  return (
    <section className="flex flex-col items-center gap-3 py-12 text-center" aria-live="polite">
      <h2 className="text-xl font-semibold">{placed.alreadyPlaced ? s["cart.placed.already"] : s["cart.placed.title"]}</h2>
      <p className="text-lg font-bold">{fill(s["cart.placed.number"], { number: placed.number })}</p>
      <p className={placed.status === "CREDIT_HOLD" ? "font-medium text-warn" : "text-ink-muted"}>{s[`cart.placed.${placed.status}`]}</p>
      <Link href={`/orders/${placed.orderId}`} className="mt-2 flex min-h-12 items-center rounded-card bg-accent px-6 font-semibold text-paper">{s["cart.placed.view"]}</Link>
      <Link href="/catalogue" className="flex min-h-12 items-center rounded-card border border-accent px-6 font-semibold text-accent">{s["cart.placed.continue"]}</Link>
    </section>
  );
}

type Update = (change: (s: CartState) => CartState) => void;

function CartLineCard({ result, cases, locked, locale, s, update }: { result: CartLineResult; cases: number; locked: boolean; locale: Locale; s: CartStrings; update: Update }) {
  const skuId = result.skuId;
  const sku = result.status === "UNKNOWN" ? null : result.sku;
  const name = sku ? (locale === "hi" ? sku.nameHi : sku.nameEn) : skuId;
  const needsAttention = result.status !== "OK";

  return (
    <li className={`flex flex-col gap-3 rounded-card border p-3 ${needsAttention ? "border-warn/60 bg-warn-soft/40" : "border-line bg-paper"}`}>
      <div className="flex gap-3">
        {sku && <PackImage shape={sku.imageKey} brand={sku.brand} size={56} />}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug">{name}</h3>
          {result.status === "OK" && <LinePrice line={result.line} s={s} />}
        </div>
        {result.status === "OK" && <p className="text-right font-bold tabular-nums">{formatPaise(result.line.lineTotalPaise)}</p>}
      </div>

      {result.status === "OK" && <OfferNotes line={result.line} nudge={locked ? null : result.nudge} locale={locale} s={s} onNudge={(target) => update((c) => setCases(c, skuId, target))} />}

      {result.status === "STOCK_SHORT" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{result.reason === "FREE_GOODS_DONT_FIT" ? s["cart.shortFree"] : s["cart.shortMore"]}</p>
          {result.options.map((o) => (
            <button
              key={o.kind}
              type="button"
              disabled={locked}
              onClick={() => update((c) => chooseOption(c, skuId, o.paidCases, o.choice))}
              className="flex min-h-12 items-center justify-between gap-2 rounded-card border border-accent bg-paper px-3 text-left text-sm"
            >
              <span className="font-medium">
                {o.kind === "WITH_FREE_GOODS"
                  ? fill(s["cart.optionWithFree"], { paid: o.paidCases, free: o.freeCases })
                  : o.kind === "MAX_AVAILABLE"
                    ? fill(s["cart.optionMax"], { paid: o.paidCases })
                    : o.discountBps > 0
                      ? fill(s["cart.optionWithoutDiscount"], { paid: o.paidCases, pct: formatBps(o.discountBps) })
                      : fill(s["cart.optionWithout"], { paid: o.paidCases })}
              </span>
              <span className="tabular-nums text-ink-muted">{formatPaise(o.lineTotalPaise)}</span>
            </button>
          ))}
        </div>
      )}

      {result.status === "OFFER_CHANGED" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{s["cart.offerChanged"]}</p>
          <button type="button" onClick={() => update((c) => chooseOption(c, skuId, result.requestedCases, "BEST"))} className="min-h-12 rounded-card border border-accent bg-paper px-3 text-sm font-medium text-accent">
            {s["cart.useBestOffer"]}
          </button>
        </div>
      )}

      {(result.status === "OUT_OF_STOCK" || result.status === "INACTIVE" || result.status === "UNKNOWN") && (
        <p className="text-sm font-medium text-danger">{s[result.status === "OUT_OF_STOCK" ? "cart.outOfStock" : result.status === "INACTIVE" ? "cart.inactive" : "cart.unknown"]}</p>
      )}

      <div className="flex items-center justify-between gap-2">
        <button type="button" disabled={locked} onClick={() => update((c) => removeLine(c, skuId))} className="min-h-11 px-2 text-sm text-ink-muted underline disabled:opacity-50">
          {s["cart.remove"]}
        </button>
        {result.status !== "OUT_OF_STOCK" && result.status !== "INACTIVE" && result.status !== "UNKNOWN" && (
          <Stepper
            value={cases}
            disabled={locked}
            onIncrease={() => update((c) => addCase(c, skuId))}
            onDecrease={() => update((c) => removeCase(c, skuId))}
            addLabel={s["cart.add"]}
            increaseLabel={fill(s["cart.increase"], { name })}
            decreaseLabel={fill(s["cart.decrease"], { name })}
            quantityLabel={fill(s["cart.quantity"], { name })}
          />
        )}
      </div>
    </li>
  );
}

function LinePrice({ line, s }: { line: LineView; s: CartStrings }) {
  return (
    <p className="text-sm text-ink-muted">
      {fill(s["cart.cases"], { n: line.paidCases })} × {formatPaise(line.casePricePaise)}
      {line.freeCases > 0 && <span className="ml-1 rounded-full bg-accent-soft px-2 font-semibold text-accent-strong">{fill(s["cart.freeCases"], { n: line.freeCases })}</span>}
    </p>
  );
}

function OfferNotes({ line, nudge, locale, s, onNudge }: { line: LineView; nudge: Extract<CartLineResult, { status: "OK" }>["nudge"]; locale: Locale; s: CartStrings; onNudge: (target: number) => void }) {
  const label = (o: OfferView) => (locale === "hi" ? o.labelHi : o.labelEn);
  return (
    <div className="flex flex-col gap-1 text-sm">
      {line.applied && <p className="text-accent-strong">{fill(s["cart.bestOffer"], { offer: label(line.applied) })}</p>}
      {line.applied && line.otherOffer && <p className="text-ink-muted">{fill(s["cart.otherOffer"], { offer: label(line.otherOffer) })}</p>}
      {nudge && (
        <button type="button" onClick={() => onNudge(nudge.targetPaidCases)} className="min-h-11 self-start rounded-full border border-dashed border-accent px-3 text-left font-medium text-accent">
          {nudge.type === "FREE_GOODS"
            ? fill(s["cart.nudgeFree"], { n: nudge.addCases, free: nudge.extraFreeCases })
            : fill(s["cart.nudgeDiscount"], { n: nudge.addCases, pct: formatBps(nudge.discountBps) })}
        </button>
      )}
    </div>
  );
}

function Totals({ preview, s }: { preview: CartPreview; s: CartStrings }) {
  const t = preview.totals;
  const row = (label: string, value: string, strong = false) => (
    <div className={`flex justify-between gap-3 ${strong ? "text-lg font-bold" : "text-sm"}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
  return (
    <dl className="flex flex-col gap-1.5 rounded-card border border-line p-3">
      {row(s["cart.taxable"], formatPaise(t.taxablePaise))}
      {t.discountPaise > 0 && row(s["cart.discount"], `− ${formatPaise(t.discountPaise)}`)}
      {t.gstByRate.map((g) => row(fill(s["cart.gstAt"], { rate: formatBps(g.gstBps) }), formatPaise(g.gstPaise)))}
      <div className="my-1 border-t border-line" />
      {row(s["cart.payable"], formatPaise(t.totalPaise), true)}
    </dl>
  );
}

function CreditPanel({ preview, s }: { preview: CartPreview; s: CartStrings }) {
  const c = preview.credit;
  const row = (label: string, value: number) => (
    <div className="flex justify-between gap-3 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="tabular-nums">{formatPaise(value)}</dd>
    </div>
  );
  return (
    <section className="flex flex-col gap-1.5 rounded-card border border-line p-3">
      <h2 className="text-sm font-semibold">{s["cart.credit.title"]}</h2>
      <dl className="flex flex-col gap-1">
        {row(s["cart.credit.limit"], c.limitPaise)}
        {row(s["cart.credit.outstanding"], c.outstandingPaise)}
        {row(s["cart.credit.openOrders"], c.openOrdersPaise)}
        {row(s["cart.credit.available"], c.availablePaise)}
      </dl>
      {c.hold && <p role="alert" className="mt-1 rounded-card bg-warn-soft p-2 text-sm font-medium text-warn">{fill(s["cart.credit.overBy"], { amount: formatPaise(c.overByPaise) })}</p>}
    </section>
  );
}
