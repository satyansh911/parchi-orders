import Link from "next/link";
import { Suspense } from "react";
import { formatDateTime, formatPaise } from "@/i18n/format";
import { getTranslator } from "@/i18n/server";
import { requirePageViewer } from "@/server/auth/viewer";
import { listOrders } from "@/server/data/orders";
import { db } from "@/server/db";
import { StatusBadge } from "./status-badge";

export const metadata = { title: "Orders · Parchi Orders" };

export default function OrdersPage() {
  return (
    <main className="px-4 pb-24">
      <Suspense fallback={<div className="mt-4 flex flex-col gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-card bg-paper-dim" />)}</div>}>
        <OrdersContent />
      </Suspense>
    </main>
  );
}

async function OrdersContent() {
  const viewer = await requirePageViewer("RETAILER", "/orders"); // before any data (D73)
  const [{ locale, t }, orders] = await Promise.all([getTranslator(), listOrders(db, viewer)]);
  return (
    <div lang={locale} className="flex flex-col gap-3 pt-4">
      <h1 className="text-xl font-semibold">{t("orders.title")}</h1>
      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-ink-muted">{t("orders.empty")}</p>
          <Link href="/catalogue" className="flex min-h-12 items-center rounded-card bg-accent px-6 font-semibold text-white">{t("cart.browse")}</Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="flex min-h-16 flex-col gap-1 rounded-card border border-line p-3 active:bg-paper-dim">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{t("orders.number", { number: o.number })}</span>
                  <span className="font-bold tabular-nums">{formatPaise(o.totalPaise)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <StatusBadge status={o.status} t={t} />
                  {o.source === "HISTORICAL_SEED" && <span className="rounded-full border border-line px-2 py-0.5">{t("orders.historical")}</span>}
                  <span>{formatDateTime(o.placedAt, locale)}</span>
                  <span>· {t("orders.items", { n: o._count.lines })}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
