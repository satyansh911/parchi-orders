"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmCaptureAction } from "@/app/actions/capture";
import { fill } from "@/i18n/fill";
import { Stepper } from "@/ui/stepper";
import { hasMergedCapture, isLocked, mergeCaptureLines, type CartLine } from "../../cart/cart-state";
import { useCart } from "../../cart/use-cart";
import type { CaptureReviewStrings } from "../strings";

export type ReviewSku = { id: string; name: string; piecesPerCase: number; inStock: boolean };
export type ReviewLine = {
  id: string;
  raw: string;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NEEDS_CLARIFICATION";
  flags: string[];
  suggestedSkuId: string | null;
  suggestedCases: number | null;
  alternativeSkuIds: string[];
};

type Draft = { key: string; lineId?: string; skuId: string | null; cases: number; removed: boolean; checked: boolean };

const CHIP: Record<ReviewLine["confidence"], string> = {
  HIGH: "bg-ok-soft text-ok",
  MEDIUM: "bg-warn-soft text-warn",
  LOW: "bg-danger-soft text-danger",
  NEEDS_CLARIFICATION: "bg-danger-soft text-danger",
};
const FLAG_ORDER = ["UNMATCHED", "PIECES", "UNIT_UNCLEAR", "QTY_UNCLEAR", "PACK_SIZE_UNCLEAR", "PRODUCT_UNCLEAR", "OUT_OF_STOCK", "DUPLICATE"] as const;
const resolved = (d: Draft) => d.removed || (d.checked && d.skuId !== null && d.cases >= 1);

/**
 * D92: every line is accepted, corrected or removed before anything reaches
 * the cart. Only HIGH lines start accepted; the others need a tap. The
 * original words stay on screen next to each suggestion.
 */
export function ReviewView({ userId, captureId, lines, skus, s }: { userId: string; captureId: string; lines: ReviewLine[]; skus: ReviewSku[]; s: CaptureReviewStrings }) {
  const router = useRouter();
  const { cart, update } = useCart(userId);
  const byId = new Map(skus.map((k) => [k.id, k]));
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    lines.map((l) => ({
      key: l.id,
      lineId: l.id,
      skuId: l.suggestedSkuId && byId.has(l.suggestedSkuId) ? l.suggestedSkuId : null,
      cases: l.suggestedCases ?? 0,
      removed: false,
      checked: l.confidence === "HIGH" && l.suggestedSkuId !== null && (l.suggestedCases ?? 0) >= 1,
    })),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<CartLine[] | null>(null);
  const merged = hasMergedCapture(cart, captureId);

  const change = (key: string, patch: Partial<Draft>) => setDrafts((all) => all.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const left = drafts.filter((d) => !resolved(d)).length;
  const kept = drafts.filter((d) => !d.removed).length;

  function finish(cartLines: CartLine[], mode: "replace" | "add") {
    update((c) => mergeCaptureLines(c, captureId, cartLines, mode));
    router.push("/cart");
  }

  function confirm() {
    if (isLocked(cart)) return setError(s["order.again.locked"]);
    if (left > 0) return;
    setError(null);
    const input = drafts.map((d) => (d.removed ? { lineId: d.lineId!, removed: true as const } : { ...(d.lineId ? { lineId: d.lineId } : {}), skuId: d.skuId!, cases: d.cases }));
    startTransition(async () => {
      try {
        const result = await confirmCaptureAction({ captureId, lines: input });
        if (!result.ok) return setError(s["capture.error"]);
        if (result.data.lines.length === 0) return router.push("/capture");
        if (cart.lines.length === 0) finish(result.data.lines, "add");
        else setChoice(result.data.lines);
      } catch {
        setError(s["capture.error"]); // safe to retry: confirmation is idempotent (D98)
      }
    });
  }

  if (merged) {
    return (
      <div className="flex flex-col gap-3 rounded-card bg-ok-soft p-4" role="status">
        <p className="font-medium text-ok">{s["capture.added"]}</p>
        <Link href="/cart" className="flex min-h-12 items-center justify-center rounded-card bg-accent font-semibold text-paper">{s["capture.goCart"]}</Link>
        <Link href="/capture" className="flex min-h-12 items-center justify-center text-accent">{s["capture.newMessage"]}</Link>
      </div>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {drafts.map((d) => {
          const line = lines.find((l) => l.id === d.lineId);
          return (
            <li key={d.key} className={`flex flex-col gap-3 rounded-card border p-3 ${resolved(d) ? "border-line" : "border-warn"}`} data-testid="capture-line">
              {line && (
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm ${d.removed ? "text-ink-faint line-through" : "text-ink-muted"}`}>“{line.raw}”</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CHIP[line.confidence]}`}>{s[`capture.conf.${line.confidence}`]}</span>
                </div>
              )}
              {d.removed ? (
                <button type="button" onClick={() => change(d.key, { removed: false })} className="min-h-11 self-start text-sm font-medium text-accent">{s["capture.undo"]}</button>
              ) : (
                <LineEditor d={d} line={line} skus={skus} byId={byId} s={s} onChange={(patch) => change(d.key, patch)} />
              )}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => setDrafts((all) => [...all, { key: `m${all.length}-${Date.now()}`, skuId: null, cases: 1, removed: false, checked: true }])}
        className="min-h-12 rounded-card border border-dashed border-line text-accent"
      >
        + {s["capture.addItem"]}
      </button>

      <div className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-3xl border-t border-line bg-paper p-3">
        {error && <p role="alert" className="mb-2 text-sm text-danger">{error}</p>}
        {choice ? (
          <div role="group" className="flex flex-col gap-2">
            <p className="text-sm">{s["order.again.cartNotEmpty"]}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => finish(choice, "replace")} className="min-h-12 flex-1 rounded-card border border-accent font-medium text-accent">{s["order.again.replace"]}</button>
              <button type="button" onClick={() => finish(choice, "add")} className="min-h-12 flex-1 rounded-card bg-accent font-semibold text-paper">{s["order.again.add"]}</button>
            </div>
          </div>
        ) : (
          <>
            {left > 0 && <p className="mb-2 text-sm text-warn">{fill(s["capture.fixFirst"], { n: left })}</p>}
            <button type="button" disabled={pending || left > 0} onClick={confirm} className="min-h-14 w-full rounded-card bg-accent text-lg font-semibold text-paper disabled:bg-paper-dim disabled:text-ink-faint">
              {pending ? s["capture.adding"] : fill(s["capture.addToCart"], { n: kept })}
            </button>
          </>
        )}
      </div>
    </>
  );
}

function LineEditor({ d, line, skus, byId, s, onChange }: { d: Draft; line?: ReviewLine; skus: ReviewSku[]; byId: Map<string, ReviewSku>; s: CaptureReviewStrings; onChange: (patch: Partial<Draft>) => void }) {
  const sku = d.skuId ? byId.get(d.skuId) : undefined;
  const alternatives = (line?.alternativeSkuIds ?? []).filter((id) => id !== d.skuId && byId.has(id)).slice(0, 2);
  const flags = FLAG_ORDER.filter((f) => line?.flags.includes(f) && !(f === "OUT_OF_STOCK" && sku?.inStock));
  return (
    <>
      {!d.checked && flags.length > 0 && (
        <ul className="flex flex-col gap-1">
          {flags.map((f) => (
            <li key={f} className="text-sm text-warn">{fill(s[`capture.flag.${f}`], { n: sku?.piecesPerCase ?? "" })}</li>
          ))}
        </ul>
      )}
      <label className="flex flex-col gap-1">
        <span className="sr-only">{d.skuId ? s["capture.choose"] : s["capture.pick"]}</span>
        <select
          value={d.skuId ?? ""}
          onChange={(e) => onChange({ skuId: e.target.value || null, checked: d.cases >= 1 && e.target.value !== "" })}
          className="min-h-12 w-full rounded-card border border-line bg-paper px-3 text-base font-medium"
        >
          <option value="">{s["capture.pick"]}</option>
          {skus.map((k) => (
            <option key={k.id} value={k.id}>{k.name}</option>
          ))}
        </select>
      </label>
      {alternatives.length > 0 && !d.checked && (
        <div className="flex flex-wrap gap-2">
          {alternatives.map((id) => (
            <button key={id} type="button" onClick={() => onChange({ skuId: id })} className="min-h-11 rounded-full border border-line px-3 text-sm">
              {byId.get(id)!.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <Stepper
          value={d.cases}
          onIncrease={() => onChange({ cases: Math.min(999, d.cases + 1) })}
          onDecrease={() => onChange({ cases: Math.max(1, d.cases - 1) })}
          addLabel={s["cart.add"]}
          increaseLabel={s["cart.increase"]}
          decreaseLabel={s["cart.decrease"]}
          quantityLabel={s["cart.quantity"]}
        />
        <div className="flex gap-2">
          <button type="button" onClick={() => onChange({ removed: true })} className="min-h-11 px-2 text-sm text-danger">{s["capture.remove"]}</button>
          {!d.checked && (
            <button type="button" disabled={!d.skuId || d.cases < 1} onClick={() => onChange({ checked: true })} className="min-h-11 rounded-card bg-accent px-3 text-sm font-semibold text-paper disabled:opacity-50">
              {s["capture.ok"]}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
