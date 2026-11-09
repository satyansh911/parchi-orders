import type { ReactNode } from "react";
import { cardOffer, freeProgress } from "@/domain/pricing/card-offer";
import { fill } from "@/i18n/fill";
import { formatBps, formatPaise, formatPaiseCompact } from "@/i18n/format";
import type { Locale } from "@/i18n/messages";
import type { CatalogueItem } from "@/server/catalogue/catalogue";
import { PackImage } from "@/ui/pack-image";
import type { CatalogueStrings } from "./strings";

// One product per row at 360 px, a grid on wider screens (D80). The retailer's
// case price is the biggest thing on the card and always says "+ GST" (A.2).
// When the cases in the cart earn a discount, the original price is struck
// through next to the new one; earned free cases show as a FREE chip. Display
// only: the cart prices everything for real (D74).
export function ProductRow({ item, locale, s, cases = 0, action }: { item: CatalogueItem; locale: Locale; s: CatalogueStrings; cases?: number; action?: ReactNode }) {
  const name = locale === "hi" ? item.nameHi : item.nameEn;
  const offer = cardOffer(item.casePricePaise, cases, item.offers);
  const progress = offer.kind === "FREE" ? null : freeProgress(cases, item.offers);
  const inCart = cases > 0;
  return (
    <li className={`grid grid-cols-[88px_minmax(0,1fr)] gap-3 rounded-card border bg-paper p-3 transition-colors ${inCart ? "border-accent/40" : "border-line"}`}>
      <PackImage shape={item.imageKey} brand={item.brand} name={item.nameEn} packSize={item.packSize} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="text-base font-semibold leading-snug">{name}</h3>
        <p className="text-xs text-ink-faint">{fill(s["catalogue.piecesPerCase"], { n: item.piecesPerCase })}</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
          {offer.kind === "DISCOUNT" ? (
            <>
              <s key="was" className="was num text-sm">{formatPaise(item.casePricePaise)}</s>
              <span key={`now-${offer.casePricePaise}`} className="price-new num text-xl font-bold leading-7">{formatPaise(offer.casePricePaise)}</span>
            </>
          ) : (
            <span className="num text-xl font-bold leading-7">{formatPaise(item.casePricePaise)}</span>
          )}
          <span className="text-xs font-medium text-ink-faint">{s["catalogue.perCase"]} {s["catalogue.gstExtra"]}</span>
        </p>
        <p className="num text-xs text-ink-faint">
          {fill(s["catalogue.perPiece"], { price: formatPaise(item.piecePricePaise) })}
          {item.mrpPaise !== null && <> · {fill(s["catalogue.mrp"], { price: formatPaiseCompact(item.mrpPaise) })}</>}
        </p>
      </div>
      <div className="col-span-2 flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <StockBadge item={item} s={s} />
          {offer.kind === "DISCOUNT" ? (
            <span className="anim-pop self-start rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-semibold text-ok-strong">✓ {fill(s["catalogue.discountOn"], { pct: formatBps(offer.discountBps) })}</span>
          ) : offer.kind === "FREE" ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <span key={offer.freeCases} className="confetti anim-pop rounded-full bg-ok px-2.5 py-0.5 text-xs font-bold tracking-wide text-white">
                {s["catalogue.free"]}<i /><i /><i /><i />
              </span>
              <span className="num text-xs font-semibold text-ok-strong">{fill(s["catalogue.freeEarned"], { paid: cases, free: offer.freeCases, value: formatPaise(offer.freeValuePaise) })}</span>
            </span>
          ) : (
            item.offers.length > 0 && (
              <span className="flex flex-wrap gap-1">
                {item.offers.map((o) => (
                  <span key={o.id} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-strong">{locale === "hi" ? o.labelHi : o.labelEn}</span>
                ))}
              </span>
            )
          )}
          {progress && progress.have > 0 && (
            <span className="flex items-center gap-2" aria-hidden="true">
              <span className="prog w-20"><i style={{ width: `${(progress.have / progress.need) * 100}%` }} /></span>
              <span className="num text-xs text-ink-faint">{fill(s["catalogue.nextFree"], { n: progress.need - progress.have, free: progress.freeCases })}</span>
            </span>
          )}
        </div>
        {action}
      </div>
    </li>
  );
}

function StockBadge({ item, s }: { item: CatalogueItem; s: CatalogueStrings }) {
  const { stock } = item;
  const [label, tone, dot] =
    stock.status === "OUT" ? [s["catalogue.outOfStock"], "text-danger", "bg-danger"]
    : stock.status === "LOW" ? [fill(s["catalogue.lowStock"], { n: stock.casesLeft }), "text-warn", "bg-warn-bar"]
    : [s["catalogue.inStock"], "text-ok-strong", "bg-ok"];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${tone}`}>
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}
