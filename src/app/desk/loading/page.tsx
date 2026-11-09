import { Suspense } from "react";
import { formatPaise } from "@/i18n/format";
import { requirePageViewer } from "@/server/auth/viewer";
import { DATE_ONLY, istToday, vanLoadingLists } from "@/server/data/loading";
import { db } from "@/server/db";
import { PrintButton } from "./print-button";

export const metadata = { title: "Van loading lists · Order desk" };

export default function LoadingPage({ searchParams }: PageProps<"/desk/loading">) {
  return (
    <main className="px-4 pb-12">
      <Suspense fallback={<div className="mt-4 h-64 animate-pulse rounded-card bg-paper-dim" />}>
        <Loading searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Loading({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requirePageViewer("DESK", "/desk/loading");
  const raw = (await searchParams).date;
  const day = typeof raw === "string" && DATE_ONLY.test(raw) ? raw : istToday(new Date());
  const vans = await vanLoadingLists(db, viewer, day);
  return (
    <div className="flex flex-col gap-5 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Van loading lists</h1>
          <p className="text-sm text-ink-muted">Orders approved on {day} (IST), approved or exported. Cases include free goods.</p>
        </div>
        <form method="get" className="flex items-end gap-2 print:hidden">
          <label className="flex flex-col text-sm">
            <span className="text-ink-muted">Date</span>
            <input type="date" name="date" defaultValue={day} className="min-h-11 rounded-card border border-line px-3" />
          </label>
          <button type="submit" className="min-h-11 rounded-card bg-accent px-4 text-sm font-semibold text-paper">Show</button>
          <PrintButton />
        </form>
      </div>
      {vans.length === 0 ? (
        <p className="rounded-card bg-paper-dim p-6 text-center text-ink-muted">No approved orders on {day}.</p>
      ) : (
        vans.map((v) => (
          <section key={v.vanCode} className="flex flex-col gap-3 rounded-card border border-line p-4 break-inside-avoid print:break-after-page">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">{v.vanName}</h2>
              <p className="text-sm text-ink-muted">{v.orderCount} orders · {v.drops.length} shops · <span className="font-semibold text-ink">{v.totalCases} cases</span> · {formatPaise(v.totalPaise)}</p>
            </header>
            <div>
              <h3 className="mb-1 text-sm font-semibold">Load</h3>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line text-left text-ink-muted"><th className="py-1">Item</th><th className="py-1 text-right">Paid</th><th className="py-1 text-right">Free</th><th className="py-1 text-right">Total cases</th></tr></thead>
                <tbody>
                  {v.skus.map((s) => (
                    <tr key={s.skuCode} className="border-b border-line">
                      <td className="py-1">{s.nameEn} <span className="text-xs text-ink-muted">{s.skuCode}</span></td>
                      <td className="py-1 text-right tabular-nums">{s.paidCases}</td>
                      <td className="py-1 text-right tabular-nums">{s.freeCases}</td>
                      <td className="py-1 text-right font-semibold tabular-nums">{s.totalCases}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold">Drops</h3>
              <ol className="flex flex-col gap-2">
                {v.drops.map((d, i) => (
                  <li key={d.retailerCode} className="rounded-card bg-paper-dim p-2 text-sm">
                    <p className="font-medium">{i + 1}. {d.shopName} <span className="text-xs text-ink-muted">{d.retailerCode} · {d.area} · order {d.orders.map((n) => `#${n}`).join(", ")} · {formatPaise(d.totalPaise)}</span></p>
                    <p className="text-ink-muted">{d.lines.map((l) => `${l.nameEn} × ${l.totalCases}${l.freeCases ? ` (${l.freeCases} free)` : ""}`).join(" · ")}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
