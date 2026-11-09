import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatBps, formatPaise } from "@/i18n/format";
import { AccessError } from "@/server/auth/access-error";
import { requirePageViewer } from "@/server/auth/viewer";
import { creditPositionFor } from "@/server/data/credit";
import { deskOrder } from "@/server/data/desk";
import { db } from "@/server/db";
import { EDITABLE } from "@/server/desk/edit-line";
import { dateTime, DeskStatus, STATUS_LABEL } from "../../status";
import { DecisionPanel, LineEditor } from "./desk-actions";

export const metadata = { title: "Order · Order desk" };

export default function DeskOrderPage({ params }: PageProps<"/desk/orders/[id]">) {
  return (
    <main className="px-4 pb-12">
      <Suspense fallback={<div className="mt-4 h-64 animate-pulse rounded-card bg-paper-dim" />}>
        <OrderDetail params={params} />
      </Suspense>
    </main>
  );
}

async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requirePageViewer("DESK", `/desk/orders/${id}`);
  let order;
  try {
    order = await deskOrder(db, viewer, id);
  } catch (error) {
    if (error instanceof AccessError) notFound();
    throw error;
  }
  const credit = await creditPositionFor(db, order.retailer.id);
  const editable = (EDITABLE as readonly string[]).includes(order.status);
  const gstByRate = new Map<number, number>();
  for (const l of order.lines) gstByRate.set(l.gstBps, (gstByRate.get(l.gstBps) ?? 0) + l.gstPaise);

  return (
    <div className="flex flex-col gap-5 pt-4">
      <Link href="/desk" className="min-h-11 self-start py-2 text-sm text-accent">← Queue</Link>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Order #{order.number}</h1>
          <p className="text-sm text-ink-muted">{dateTime(order.placedAt)} · {order.source === "AI_CAPTURE" ? "From message" : order.source === "REPEAT" ? "Repeat order" : "Catalogue"}{order.exportBatch && ` · Batch ${order.exportBatch.number}`}</p>
        </div>
        <DeskStatus status={order.status} />
      </header>

      {order.awaitingRetailerAck && <p className="rounded-card bg-warn-soft p-3 text-sm text-warn">Desk changes raised the total. The retailer must accept before approval.</p>}
      {order.cancelRequestedAt && <p className="rounded-card bg-danger-soft p-3 text-sm text-danger">The retailer asked to cancel this order ({dateTime(order.cancelRequestedAt)}).</p>}

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-line p-3">
          <h2 className="text-xs font-medium text-ink-muted">Retailer</h2>
          <p className="font-medium">{order.retailer.shopName}</p>
          <p className="text-sm text-ink-muted">{order.retailer.code} · {order.retailer.ownerName} · {order.retailer.area} · {order.retailer.tier.name}</p>
        </div>
        <div className="rounded-card border border-line p-3 text-sm">
          <h2 className="text-xs font-medium text-ink-muted">Credit now</h2>
          <p>Limit {formatPaise(credit.limitPaise)} · Outstanding {formatPaise(credit.outstandingPaise)}</p>
          <p>Open orders {formatPaise(credit.openOrdersPaise)} · {credit.alreadyOverPaise > 0 ? <span className="font-medium text-warn">Over by {formatPaise(credit.alreadyOverPaise)}</span> : <>Available {formatPaise(credit.availablePaise)}</>}</p>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Lines</h2>
        <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
          {order.lines.map((l) => (
            <li key={l.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{l.nameEn} <span className="text-xs text-ink-muted">{l.skuCode}</span></p>
                <p className="text-sm text-ink-muted">
                  {l.paidCases} cases{l.freeCases > 0 && <> + {l.freeCases} free</>} × {formatPaise(l.casePricePaise)} = {formatPaise(l.taxablePaise)}
                  {l.discountPaise > 0 && <> − {formatBps(l.discountBps)} ({formatPaise(l.discountPaise)})</>} + GST {formatBps(l.gstBps)} {formatPaise(l.gstPaise)}
                </p>
                {l.appliedLabel && <p className="text-xs text-accent">{l.appliedLabel}{l.otherOfferLabel && ` · also eligible: ${l.otherOfferLabel}`}</p>}
              </div>
              <div className="flex items-center gap-3">
                <p className="font-semibold tabular-nums">{formatPaise(l.lineTotalPaise)}</p>
                {editable && <LineEditor orderId={order.id} version={order.version} lineId={l.id} paidCases={l.paidCases} canRemove={order.lines.length > 1} />}
              </div>
            </li>
          ))}
        </ul>
        <dl className="ml-auto grid w-full max-w-xs grid-cols-2 gap-1 text-sm">
          <dt className="text-ink-muted">Taxable</dt><dd className="text-right tabular-nums">{formatPaise(order.taxablePaise)}</dd>
          <dt className="text-ink-muted">Discount</dt><dd className="text-right tabular-nums">− {formatPaise(order.discountPaise)}</dd>
          {[...gstByRate].map(([bps, paise]) => (
            <Fragment key={bps}><dt className="text-ink-muted">GST {formatBps(bps)}</dt><dd className="text-right tabular-nums">{formatPaise(paise)}</dd></Fragment>
          ))}
          <dt className="font-semibold">Total (incl. GST)</dt><dd className="text-right font-semibold tabular-nums">{formatPaise(order.totalPaise)}</dd>
          {order.originalTotalPaise !== order.totalPaise && <><dt className="text-ink-muted">At placement</dt><dd className="text-right tabular-nums text-ink-muted">{formatPaise(order.originalTotalPaise)}</dd></>}
        </dl>
      </section>

      <DecisionPanel orderId={order.id} version={order.version} status={order.status} awaitingRetailerAck={order.awaitingRetailerAck} />

      {order.capture && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Original message</h2>
          <blockquote className="whitespace-pre-wrap rounded-card bg-paper-dim p-3 text-sm">{order.capture.rawText}</blockquote>
          <ul className="flex flex-col gap-1 text-sm">
            {order.capture.lines.map((c) => (
              <li key={c.id}>“{c.raw}” → {c.resolution.toLowerCase()} ({c.confidence.toLowerCase().replace("_", " ")})</li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">History</h2>
        <ol className="flex flex-col gap-2 border-l border-line pl-4 text-sm">
          {order.events.map((e) => (
            <li key={e.id}>
              <p><span className="font-medium">{e.type.replaceAll("_", " ").toLowerCase()}</span>{e.toStatus && <> → {STATUS_LABEL[e.toStatus]}</>}{e.reason && <>: {e.reason}</>}</p>
              <p className="text-xs text-ink-muted">{dateTime(e.createdAt)} · {e.actor ? `${e.actor.name}` : "System"}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
