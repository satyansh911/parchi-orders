import type { ReactNode } from "react";
import { fill } from "@/i18n/fill";
import { formatPaise, formatPaiseCompact } from "@/i18n/format";
import type { Locale } from "@/i18n/messages";
import type { CatalogueItem } from "@/server/catalogue/catalogue";
import { PackImage } from "@/ui/pack-image";
import type { CatalogueStrings } from "./strings";

// One product per row at 360 px (D80). The retailer's case price is the
// biggest thing on the card and always says "+ GST" (A.2). MRP is small and
// labelled, so it can't be mistaken for the dealer price.
export function ProductRow({ item, locale, s, action }: { item: CatalogueItem; locale: Locale; s: CatalogueStrings; action?: ReactNode }) {
  const name = locale === "hi" ? item.nameHi : item.nameEn;
  return (
    <li className="flex gap-3 rounded-card border border-line bg-paper p-3">
      <PackImage shape={item.imageKey} brand={item.brand} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="text-base font-semibold leading-snug">{name}</h3>
        <p className="text-xs text-ink-muted">
          {fill(s["catalogue.piecesPerCase"], { n: item.piecesPerCase })}
          {item.mrpPaise !== null && <> · {fill(s["catalogue.mrp"], { price: formatPaiseCompact(item.mrpPaise) })}</>}
        </p>
        <p className="flex flex-wrap items-baseline gap-x-1">
          <span className="text-lg font-bold">{formatPaise(item.casePricePaise)}</span>
          <span className="text-sm text-ink-muted">{s["catalogue.perCase"]}</span>
          <span className="rounded bg-paper-dim px-1.5 text-xs font-medium text-ink-muted">{s["catalogue.gstExtra"]}</span>
        </p>
        <p className="text-xs text-ink-muted">{fill(s["catalogue.perPiece"], { price: formatPaise(item.piecePricePaise) })}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <StockBadge item={item} s={s} />
          {item.offers.map((offer) => (
            <span key={offer.id} className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong">
              {locale === "hi" ? offer.labelHi : offer.labelEn}
            </span>
          ))}
        </div>
        {action && <div className="mt-1 flex justify-end">{action}</div>}
      </div>
    </li>
  );
}

function StockBadge({ item, s }: { item: CatalogueItem; s: CatalogueStrings }) {
  const { stock } = item;
  if (stock.status === "OUT") return <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">{s["catalogue.outOfStock"]}</span>;
  if (stock.status === "LOW") return <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">{fill(s["catalogue.lowStock"], { n: stock.casesLeft })}</span>;
  return <span className="rounded-full bg-ok-soft px-2 py-0.5 text-xs font-medium text-ok">{s["catalogue.inStock"]}</span>;
}
