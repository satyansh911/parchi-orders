import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatBps, formatDateTime, formatPaise } from "@/i18n/format";
import { getTranslator, pickStrings } from "@/i18n/server";
import { AccessError } from "@/server/auth/access-error";
import { requirePageViewer } from "@/server/auth/viewer";
import { getOrder } from "@/server/data/orders";
import { db } from "@/server/db";
import { AcceptChanges } from "../accept-changes";
import { OrderActions } from "../order-actions";
import { OrderAgainButton } from "../order-again";
import { StatusBadge } from "../status-badge";
import { ORDER_ACTION_STRING_KEYS, ORDER_AGAIN_STRING_KEYS } from "../strings";

export const metadata = { title: "Order · Parchi Orders" };

export default function OrderPage({ params }: PageProps<"/orders/[id]">) {
  return (
    <main className="px-4 pb-24">
      <Suspense fallback={<div className="mt-4 h-64 animate-pulse rounded-card bg-paper-dim" />}>
        <OrderContent params={params} />
      </Suspense>
    </main>
  );
}

async function OrderContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requirePageViewer("RETAILER", `/orders/${id}`); // before any data (D73)
  let order;
  try {
    order = await getOrder(db, viewer, id); // another retailer's order is NOT_FOUND (D62)
  } catch (error) {
    if (error instanceof AccessError) notFound();
    throw error;
  }
  const { locale, t } = await getTranslator();
  const name = (l: { nameEn: string; nameHi: string }) => (locale === "hi" ? l.nameHi : l.nameEn);
  const gstByRate = new Map<number, number>();
  for (const l of order.lines) gstByRate.set(l.gstBps, (gstByRate.get(l.gstBps) ?? 0) + l.gstPaise);

  return (
    <div lang={locale} className="flex flex-col gap-4 pt-4">
      <Link href="/orders" className="min-h-11 self-start py-2 text-sm text-accent">← {t("order.back")}</Link>
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">{t("orders.number", { number: order.number })}</h1>
          <StatusBadge status={order.status} t={t} />
        </div>
        <p className="text-sm text-ink-muted">
          {t("order.placedOn", { date: formatDateTime(order.placedAt, locale) })}
          {order.source === "HISTORICAL_SEED" && <> · {t("orders.historical")}</>}
        </p>
        {order.status === "CREDIT_HOLD" && <p className="rounded-card bg-warn-soft p-2 text-sm font-medium text-warn">{t("order.holdNote")}</p>}
        {order.cancelRequestedAt && <p className="rounded-card bg-paper-dim p-2 text-sm">{t("order.requested", { date: formatDateTime(order.cancelRequestedAt, locale) })}</p>}
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t("order.items")}</h2>
        <ul className="flex flex-col gap-2">
          {order.lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-3 rounded-card border border-line p-3">
              <div className="min-w-0">
                <p className="font-medium">{name(l)}</p>
                <p className="text-sm text-ink-muted">
                  {t("cart.cases", { n: l.paidCases })} × {formatPaise(l.casePricePaise)}
                  {l.freeCases > 0 && <span className="ml-1 rounded-full bg-accent-soft px-2 font-semibold text-accent-strong">{t("cart.freeCases", { n: l.freeCases })}</span>}
                </p>
                {l.discountPaise > 0 && <p className="text-xs text-ink-muted">{t("cart.discount")} {formatBps(l.discountBps)}: − {formatPaise(l.discountPaise)}</p>}
              </div>
              <p className="font-bold tabular-nums">{formatPaise(l.lineTotalPaise)}</p>
            </li>
          ))}
        </ul>
      </section>

      <dl className="flex flex-col gap-1.5 rounded-card border border-line p-3 text-sm">
        <div className="flex justify-between"><dt>{t("cart.taxable")}</dt><dd className="tabular-nums">{formatPaise(order.taxablePaise)}</dd></div>
        {order.discountPaise > 0 && <div className="flex justify-between"><dt>{t("cart.discount")}</dt><dd className="tabular-nums">− {formatPaise(order.discountPaise)}</dd></div>}
        {[...gstByRate].sort(([a], [b]) => a - b).map(([bps, paise]) => (
          <div key={bps} className="flex justify-between"><dt>{t("cart.gstAt", { rate: formatBps(bps) })}</dt><dd className="tabular-nums">{formatPaise(paise)}</dd></div>
        ))}
        <div className="my-1 border-t border-line" />
        <div className="flex justify-between text-lg font-bold"><dt>{t("cart.payable")}</dt><dd className="tabular-nums">{formatPaise(order.totalPaise)}</dd></div>
      </dl>
      <p className="text-xs text-ink-muted">{t("order.frozenNote")}</p>

      <OrderAgainButton userId={viewer.userId} orderId={order.id} s={pickStrings(t, ORDER_AGAIN_STRING_KEYS)} />
      {order.awaitingRetailerAck && (
        <AcceptChanges orderId={order.id} body={t("order.ack.body", { total: formatPaise(order.totalPaise), was: formatPaise(order.originalTotalPaise) })} label={t("order.ack.accept")} error={t("common.error")} />
      )}
      <OrderActions orderId={order.id} status={order.status} cancelRequested={order.cancelRequestedAt !== null} s={pickStrings(t, ORDER_ACTION_STRING_KEYS)} />
    </div>
  );
}
