import { Suspense } from "react";
import { INACTIVE_AFTER_DAYS } from "@/domain/retailers/inactivity";
import { formatPaise } from "@/i18n/format";
import { requirePageViewer } from "@/server/auth/viewer";
import { inactiveRetailers } from "@/server/data/inactive";
import { db } from "@/server/db";
import { dateTime } from "../status";

export const metadata = { title: "Inactive retailers · Order desk" };

export default function InactivePage() {
  return (
    <main className="px-4 pb-12">
      <Suspense fallback={<div className="mt-4 h-64 animate-pulse rounded-card bg-paper-dim" />}>
        <Inactive />
      </Suspense>
    </main>
  );
}

async function Inactive() {
  const viewer = await requirePageViewer("DESK", "/desk/inactive");
  const shops = await inactiveRetailers(db, viewer, new Date());
  return (
    <div className="flex flex-col gap-4 pt-4">
      <div>
        <h1 className="text-xl font-semibold">No order in {INACTIVE_AFTER_DAYS} days</h1>
        <p className="text-sm text-ink-muted">{shops.length} retailers to follow up. Cancelled orders don&apos;t count as activity.</p>
      </div>
      {shops.length === 0 ? (
        <p className="rounded-card bg-paper-dim p-6 text-center text-ink-muted">Every retailer has ordered in the last {INACTIVE_AFTER_DAYS} days.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-card border border-line">
          {shops.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {s.shopName} <span className="text-xs text-ink-muted">{s.code}</span>
                </p>
                <p className="text-sm text-ink-muted">
                  {s.ownerName} · {s.area}
                  {s.salesman && ` · ${s.salesman.name}`} · outstanding {formatPaise(s.outstandingPaise)}
                </p>
                <p className="text-sm">
                  {s.daysSince === null ? (
                    <span className="font-medium text-danger">Never ordered</span>
                  ) : (
                    <>
                      <span className="font-semibold text-warn">{s.daysSince} days</span> since last order ({dateTime(s.lastOrderAt!)})
                    </>
                  )}
                </p>
              </div>
              {s.phone && (
                <a href={`tel:+91${s.phone}`} className="flex min-h-11 items-center rounded-card border border-accent px-4 text-sm font-medium text-accent">
                  Call {s.phone}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
