// Writes the planned past orders (D36), priced by the same domain engine the
// app uses, through the same row-to-domain mapper as the server.
//
// They are completed history from before the app existed: source
// HISTORICAL_SEED (D66) so they are never mistaken for app orders, status EXPORTED,
// no ExportBatch (they were keyed into Tally by hand), and current stock is
// not touched. The credit snapshot is not known historically, so it is
// recorded as the retailer's current limit minus outstanding.

import type { PrismaClient } from "../../src/generated/prisma/client";
import { priceOrder } from "../../src/domain/pricing/price-order";
import { toCatalogueSku } from "../../src/server/catalogue/to-domain";
import { planPastOrders } from "./past-orders";
import { DESK_USER } from "./people";

const HOUR_MS = 60 * 60 * 1000;

export async function seedPastOrders(db: PrismaClient) {
  const skus = await db.sku.findMany({ include: { schemes: true } });
  const catalogue = new Map(skus.map((row) => [row.code, toCatalogueSku(row)]));
  const retailers = new Map(
    (await db.retailer.findMany({ include: { tier: true, users: true } })).map((r) => [r.code, r]),
  );
  const desk = await db.user.findUniqueOrThrow({ where: { phone: DESK_USER.phone } });

  const plans = planPastOrders().sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime());
  let lineCount = 0;

  for (const plan of plans) {
    const retailer = retailers.get(plan.retailerCode);
    const user = retailer?.users[0];
    if (!retailer || !user) throw new Error(`Unknown retailer ${plan.retailerCode}`);

    const priced = priceOrder(
      plan.lines.map((l) => {
        const sku = catalogue.get(l.skuCode);
        if (!sku) throw new Error(`Unknown SKU ${l.skuCode}`);
        return { sku, paidCases: l.paidCases };
      }),
      { tierDiscountBps: retailer.tier.discountBps, now: plan.placedAt },
    );

    const approvedAt = new Date(plan.placedAt.getTime() + 2 * HOUR_MS);
    const exportedAt = new Date(plan.placedAt.getTime() + 20 * HOUR_MS);

    await db.order.create({
      data: {
        clientRequestId: `seed-${plan.retailerCode}-${plan.index}`,
        retailerId: retailer.id,
        placedById: user.id,
        source: "HISTORICAL_SEED",
        status: "EXPORTED",
        taxablePaise: priced.taxablePaise,
        discountPaise: priced.discountPaise,
        gstPaise: priced.gstPaise,
        totalPaise: priced.totalPaise,
        originalTotalPaise: priced.totalPaise,
        creditLimitPaise: retailer.creditLimitPaise,
        availableCreditPaise: Math.max(0, retailer.creditLimitPaise - retailer.outstandingPaise),
        overLimitPaise: 0,
        creditCheckedAt: plan.placedAt,
        placedAt: plan.placedAt,
        approvedAt,
        approvedById: desk.id,
        exportedAt,
        lines: {
          create: priced.lines.map((line) => {
            const sku = [...catalogue.values()].find((s) => s.id === line.skuId)!;
            return {
              skuId: line.skuId,
              skuCode: sku.code,
              nameEn: sku.nameEn,
              nameHi: sku.nameHi,
              paidCases: line.paidCases,
              freeCases: line.freeCases,
              casePricePaise: line.casePricePaise,
              taxablePaise: line.taxablePaise,
              discountBps: line.discountBps,
              discountPaise: line.discountPaise,
              gstBps: line.gstBps,
              gstPaise: line.gstPaise,
              lineTotalPaise: line.lineTotalPaise,
              freeValuePaise: line.freeValuePaise,
              appliedSchemeId: line.applied?.id ?? null,
              appliedLabel: line.applied?.labelEn ?? null,
              otherOfferLabel: line.otherOffer?.labelEn ?? null,
              offerSelection: "BEST_OFFER" as const,
            };
          }),
        },
        events: {
          create: [
            { type: "PLACED", actorId: user.id, toStatus: "PENDING_REVIEW", createdAt: plan.placedAt },
            { type: "STATUS_CHANGED", actorId: desk.id, fromStatus: "PENDING_REVIEW", toStatus: "APPROVED", createdAt: approvedAt },
            { type: "EXPORTED", actorId: desk.id, fromStatus: "APPROVED", toStatus: "EXPORTED", reason: "Keyed into Tally before the app", createdAt: exportedAt },
          ],
        },
      },
    });
    lineCount += priced.lines.length;
  }

  return { orders: plans.length, lines: lineCount };
}
