import Link from "next/link";
import { Suspense } from "react";
import { formatPaise } from "@/i18n/format";
import { requirePageViewer } from "@/server/auth/viewer";
import { deskQueue, isQueueFilter, QUEUE_FILTERS, type QueueFilter } from "@/server/data/desk";
import { db } from "@/server/db";
import { dateTime, DeskStatus } from "./status";

export const metadata = { title: "Order desk · Parchi Orders" };

export default function DeskPage({ searchParams }: PageProps<"/desk">) {
  return (
    <main className="px-4 pb-12">
      <Suspense fallback={<div className="mt-4 h-64 animate-pulse rounded-card bg-paper-dim" />}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Queue({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requirePageViewer("DESK", "/desk");
  const raw = (await searchParams).filter;
  const filter: QueueFilter = isQueueFilter(raw) ? raw : "action";
  const { orders, counts } = await deskQueue(db, viewer, filter);
  return (
    <div className="flex flex-col gap-4 pt-4">
      <nav aria-label="Order filters" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {(Object.keys(QUEUE_FILTERS) as QueueFilter[]).map((k) => (
          <Link key={k} href={`/desk?filter=${k}`} aria-current={k === filter ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm ${k === filter ? "border-accent bg-accent text-paper" : "border-line"}`}>
            {QUEUE_FILTERS[k].label}<span className="tabular-nums opacity-80">{counts[k]}</span>
          </Link>
        ))}
      </nav>
      {orders.length === 0 ? (
        <p className="rounded-card bg-paper-dim p-6 text-center text-ink-muted">No orders here.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/desk/orders/${o.id}`} className="flex min-h-16 flex-col gap-1 p-3 hover:bg-paper-dim">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium">#{o.number} · {o.retailer.shopName}</p>
                  <DeskStatus status={o.status} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                  <span className="font-semibold text-ink tabular-nums">{formatPaise(o.totalPaise)}</span>
                  <span>{o._count.lines} lines</span>
                  <span>{o.retailer.code} · {o.retailer.area}</span>
                  <span>{dateTime(o.placedAt)}</span>
                  {o.source === "AI_CAPTURE" && <span className="text-accent">From message</span>}
                  {o.status === "CREDIT_HOLD" && o.overLimitPaise > 0 && <span className="text-warn">Over by {formatPaise(o.overLimitPaise)}</span>}
                  {o.awaitingRetailerAck && <span className="text-warn">Awaiting retailer</span>}
                  {o.cancelRequestedAt && <span className="text-danger">Cancel requested</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
