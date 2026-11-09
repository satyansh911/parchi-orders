// Confirm a capture into cart lines (D92, D98). Idempotent: the first call
// stores every line's resolution and marks the capture CONFIRMED; later calls
// return the same stored result and ignore new input. Original words and the
// model's interpretation are never changed. No order, no stock reservation.

import type { PrismaClient } from "@/generated/prisma/client";
import { MAX_CAPTURE_LINES } from "@/domain/capture/postprocess";
import { AccessError } from "../auth/access-error";

export type ConfirmLine = { lineId: string; removed: true } | { lineId?: string; skuId: string; cases: number };
export type ConfirmResult = { lines: Array<{ skuId: string; paidCases: number }>; alreadyConfirmed: boolean };

export async function confirmCapture(db: PrismaClient, who: { userId: string; retailerId: string }, captureId: string, input: ConfirmLine[], now: Date): Promise<ConfirmResult> {
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Capture" WHERE id = ${captureId} AND "retailerId" = ${who.retailerId} FOR UPDATE`;
    if (locked.length === 0) throw new AccessError("NOT_FOUND");
    const capture = await tx.capture.findUniqueOrThrow({ where: { id: captureId }, include: { lines: { orderBy: { position: "asc" } } } });

    if (capture.status === "CONFIRMED") return { lines: cartLines(capture.lines), alreadyConfirmed: true };
    if (capture.status === "DISCARDED") throw new AccessError("NOT_ALLOWED");

    // D92: every extracted line resolved or explicitly removed, each exactly once.
    const byLine = new Map(input.filter((l) => l.lineId).map((l) => [l.lineId!, l]));
    const manual = input.filter((l): l is { skuId: string; cases: number } => !l.lineId && "skuId" in l);
    if (byLine.size !== input.length - manual.length || capture.lines.some((l) => !byLine.has(l.id)) || byLine.size !== capture.lines.length) throw new AccessError("NOT_ALLOWED");
    if (capture.lines.length + manual.length > MAX_CAPTURE_LINES) throw new AccessError("NOT_ALLOWED");

    const chosen = [...input.filter((l): l is { lineId?: string; skuId: string; cases: number } => "skuId" in l)];
    const active = new Set((await tx.sku.findMany({ where: { id: { in: chosen.map((l) => l.skuId) }, active: true }, select: { id: true } })).map((s) => s.id));
    if (chosen.some((l) => !active.has(l.skuId) || !Number.isInteger(l.cases) || l.cases < 1 || l.cases > 999)) throw new AccessError("NOT_ALLOWED");

    for (const line of capture.lines) {
      const r = byLine.get(line.id)!;
      if ("removed" in r) {
        await tx.captureLine.update({ where: { id: line.id }, data: { resolution: "REMOVED", resolvedById: who.userId, resolvedAt: now } });
      } else {
        const accepted = r.skuId === line.suggestedSkuId && r.cases === line.suggestedCases;
        await tx.captureLine.update({
          where: { id: line.id },
          data: { resolution: accepted ? "ACCEPTED" : "CORRECTED", resolvedSkuId: r.skuId, resolvedCases: r.cases, resolvedById: who.userId, resolvedAt: now },
        });
      }
    }
    let position = capture.lines.length;
    for (const m of manual) {
      await tx.captureLine.create({
        data: { captureId, position: position++, raw: "", confidence: "LOW", flags: ["MANUAL"], resolution: "ACCEPTED", resolvedSkuId: m.skuId, resolvedCases: m.cases, resolvedById: who.userId, resolvedAt: now },
      });
    }
    await tx.capture.update({ where: { id: captureId }, data: { status: "CONFIRMED", confirmedAt: now } });
    const stored = await tx.captureLine.findMany({ where: { captureId }, orderBy: { position: "asc" } });
    return { lines: cartLines(stored), alreadyConfirmed: false };
  });
}

/** Resolved lines → cart lines, one per SKU (D48), cases summed and capped at 999. */
function cartLines(lines: Array<{ resolution: string; resolvedSkuId: string | null; resolvedCases: number | null }>) {
  const sums = new Map<string, number>();
  for (const l of lines) {
    if ((l.resolution === "ACCEPTED" || l.resolution === "CORRECTED") && l.resolvedSkuId && l.resolvedCases) {
      sums.set(l.resolvedSkuId, Math.min(999, (sums.get(l.resolvedSkuId) ?? 0) + l.resolvedCases));
    }
  }
  return [...sums].map(([skuId, paidCases]) => ({ skuId, paidCases }));
}
