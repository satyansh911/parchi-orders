// Desk line edits (D22, D32). Only the edited line is re-priced, at today's
// price and scheme; the rest of the order stays frozen. The reservation moves
// by the difference in paid + free cases. A higher total needs the
// retailer's acknowledgement before approval.

import type { PrismaClient } from "@/generated/prisma/client";
import { priceLine } from "@/domain/pricing/price-line";
import { AccessError } from "../auth/access-error";
import { toCatalogueSku } from "../catalogue/to-domain";
import { PLACEMENT_TX } from "../orders/place-order";
import { releaseReservation, reserveStock, StockShortError } from "../stock/reservation";
import { lockOrderForDesk, VersionConflictError, type DeskActor } from "./lock";

export const EDITABLE = ["PENDING_REVIEW", "CREDIT_HOLD", "REVIEW_REQUIRED"] as const;

export type EditLineInput = { orderId: string; version: number; lineId: string; paidCases: number };
export type EditLineResult =
  | { outcome: "DONE"; totalPaise: number; awaitingRetailerAck: boolean }
  | { outcome: "STOCK_SHORT" }
  | { outcome: "CONFLICT" };

export async function editOrderLine(db: PrismaClient, desk: DeskActor, input: EditLineInput, now: Date): Promise<EditLineResult> {
  try {
    return await db.$transaction(async (tx) => {
      const order = await lockOrderForDesk(tx, input.orderId, input.version);
      if (!(EDITABLE as readonly string[]).includes(order.status)) throw new AccessError("NOT_ALLOWED");
      const line = order.lines.find((l) => l.id === input.lineId);
      if (!line) throw new AccessError("NOT_FOUND");
      const before = { skuCode: line.skuCode, paidCases: line.paidCases, freeCases: line.freeCases, lineTotalPaise: line.lineTotalPaise, appliedLabel: line.appliedLabel };

      let after: { paidCases: number; freeCases: number; lineTotalPaise: number; appliedLabel: string | null } | null = null;
      let newLineTotal = 0;
      if (input.paidCases === 0) {
        if (order.lines.length === 1) throw new AccessError("NOT_ALLOWED"); // the last line: reject the order instead
        await releaseReservation(tx, [{ skuId: line.skuId, cases: line.paidCases + line.freeCases }]);
        await tx.orderLine.delete({ where: { id: line.id } });
      } else {
        const tier = await tx.retailer.findUniqueOrThrow({ where: { id: order.retailerId }, select: { tier: { select: { discountBps: true } } } });
        const row = await tx.sku.findUniqueOrThrow({ where: { id: line.skuId }, include: { schemes: true } });
        if (!row.active) throw new AccessError("NOT_ALLOWED");
        const priced = priceLine({ sku: toCatalogueSku(row), paidCases: input.paidCases }, { tierDiscountBps: tier.tier.discountBps, now });
        const delta = priced.paidCases + priced.freeCases - (line.paidCases + line.freeCases);
        if (delta > 0) await reserveStock(tx, [{ skuId: line.skuId, cases: delta }]);
        if (delta < 0) await releaseReservation(tx, [{ skuId: line.skuId, cases: -delta }]);
        await tx.orderLine.update({
          where: { id: line.id },
          data: {
            paidCases: priced.paidCases, freeCases: priced.freeCases, casePricePaise: priced.casePricePaise, taxablePaise: priced.taxablePaise,
            discountBps: priced.discountBps, discountPaise: priced.discountPaise, gstBps: priced.gstBps, gstPaise: priced.gstPaise,
            lineTotalPaise: priced.lineTotalPaise, freeValuePaise: priced.freeValuePaise,
            appliedSchemeId: priced.applied?.id ?? null, appliedLabel: priced.applied?.labelEn ?? null, otherOfferLabel: priced.otherOffer?.labelEn ?? null,
            offerSelection: "BEST_OFFER",
          },
        });
        newLineTotal = priced.lineTotalPaise;
        after = { paidCases: priced.paidCases, freeCases: priced.freeCases, lineTotalPaise: priced.lineTotalPaise, appliedLabel: priced.applied?.labelEn ?? null };
      }

      const lines = await tx.orderLine.findMany({ where: { orderId: order.id }, select: { taxablePaise: true, discountPaise: true, gstPaise: true, lineTotalPaise: true } });
      const sum = (k: keyof (typeof lines)[number]) => lines.reduce((s, l) => s + l[k], 0);
      const totalPaise = sum("lineTotalPaise");
      const raised = totalPaise > order.totalPaise; // D32: an increase is material; a decrease is shown but doesn't block
      const awaitingRetailerAck = order.awaitingRetailerAck || raised;
      await tx.order.update({
        where: { id: order.id },
        data: {
          taxablePaise: sum("taxablePaise"), discountPaise: sum("discountPaise"), gstPaise: sum("gstPaise"), totalPaise,
          version: { increment: 1 },
          ...(raised ? { awaitingRetailerAck: true, ackRequestedAt: now, ackAcceptedAt: null } : {}),
          events: {
            create: [
              { type: input.paidCases === 0 ? "LINE_REMOVED" : "LINE_EDITED", actorId: desk.userId, payload: { lineId: line.id, before, after, orderTotalBefore: order.totalPaise, orderTotalAfter: totalPaise, lineTotalAfter: newLineTotal }, createdAt: now },
              ...(raised ? [{ type: "ACK_REQUESTED" as const, actorId: desk.userId, reason: "Desk change raised the total", payload: { from: order.totalPaise, to: totalPaise }, createdAt: now }] : []),
            ],
          },
        },
      });
      return { outcome: "DONE" as const, totalPaise, awaitingRetailerAck };
    }, PLACEMENT_TX);
  } catch (error) {
    if (error instanceof VersionConflictError) return { outcome: "CONFLICT" };
    if (error instanceof StockShortError) return { outcome: "STOCK_SHORT" };
    throw error;
  }
}
