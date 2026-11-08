// Order placement (D4, D16, D21, D22, D75, D76, D79). One transaction:
//   1. same request ID seen before → return that order (alreadyPlaced)
//   2. lock the retailer row: one placement per retailer at a time, so the
//      credit sum and duplicate check can't race (lock order: retailer, then SKUs)
//   3. re-price everything with the same engine as the preview
//   4. the signed quote must match exactly what is about to be charged
//   5. an over-limit order needs an explicit, still-current confirmation
//   6. reserve paid + free stock atomically (conditional UPDATEs, sorted)
//   7. create the order with frozen lines and audit events
// Any "not placed" outcome writes nothing and returns a fresh preview.

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { assertTransition } from "@/domain/orders/status-machine";
import type { Viewer } from "../auth/session-store";
import { priceCart, type CartLineInput, type CartPreview, type PricedCart } from "../cart/price-cart";
import { verifyQuote } from "../cart/quote";
import { reserveStock, StockShortError } from "../stock/reservation";

export type PlaceOrderInput = { clientRequestId: string; lines: CartLineInput[]; quote: string; confirmCreditHold: boolean };

export type NotPlacedProblem = "QUOTE_CHANGED" | "STOCK_CHANGED" | "CREDIT_CONFIRMATION_REQUIRED";

export type PlaceOrderResult =
  | { outcome: "PLACED"; orderId: string; number: number; status: "PENDING_REVIEW" | "CREDIT_HOLD"; alreadyPlaced: boolean }
  | { outcome: "NOT_PLACED"; problem: NotPlacedProblem; preview: CartPreview }
  | { outcome: "REJECTED" };

type Deps = { db: PrismaClient; key: Buffer; now: Date };
type Placer = Pick<Viewer, "userId"> & { retailerId: string };

export const PLACEMENT_TX = { maxWait: 5_000, timeout: 15_000 } as const;

export async function placeOrder(deps: Deps, viewer: Placer, input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const existing = await findByRequestId(deps.db, input.clientRequestId);
  if (existing) return existingResult(existing, viewer.retailerId);

  try {
    return await deps.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Retailer" WHERE id = ${viewer.retailerId} FOR UPDATE`;

      const again = await findByRequestId(tx, input.clientRequestId);
      if (again) return existingResult(again, viewer.retailerId);

      const tier = await tx.retailer.findUniqueOrThrow({ where: { id: viewer.retailerId }, select: { tier: { select: { discountBps: true } } } });
      const priced = await priceCart({ db: tx, key: deps.key, now: deps.now }, { id: viewer.retailerId, tierDiscountBps: tier.tier.discountBps }, input.lines);
      const { preview } = priced;

      // The retailer must have seen exactly this (D75): any difference, an
      // expired, foreign or tampered quote, or a cart that now needs attention.
      const check = verifyQuote(input.quote, deps.key, { retailerId: viewer.retailerId, now: deps.now });
      if (preview.problem !== null || !check.ok || check.digest !== priced.digest) {
        return notPlaced("QUOTE_CHANGED", preview);
      }
      // D79: the server decides the hold; it must have been confirmed for THIS outcome.
      if (preview.credit.hold && !input.confirmCreditHold) return notPlaced("CREDIT_CONFIRMATION_REQUIRED", preview);

      await reserveStock(tx, priced.okLines.map(({ line }) => ({ skuId: line.skuId, cases: line.paidCases + line.freeCases })));

      const status = preview.credit.hold ? "CREDIT_HOLD" : "PENDING_REVIEW";
      assertTransition("NEW", status, "SYSTEM");
      const order = await tx.order.create({ data: orderData(viewer, input, priced, status, deps.now), select: { id: true, number: true } });
      return { outcome: "PLACED", orderId: order.id, number: order.number, status, alreadyPlaced: false } as const;
    }, PLACEMENT_TX);
  } catch (error) {
    if (error instanceof StockShortError) {
      // Someone else took the stock between pricing and reserving: re-price outside the rolled-back transaction.
      return notPlaced("STOCK_CHANGED", await freshPreview(deps, viewer, input));
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await findByRequestId(deps.db, input.clientRequestId);
      if (winner) return existingResult(winner, viewer.retailerId);
    }
    throw error;
  }
}

type Db = PrismaClient | Prisma.TransactionClient;

function findByRequestId(db: Db, clientRequestId: string) {
  return db.order.findUnique({ where: { clientRequestId }, select: { id: true, number: true, status: true, retailerId: true } });
}

function existingResult(order: { id: string; number: number; status: string; retailerId: string }, retailerId: string): PlaceOrderResult {
  // Another retailer's request ID: refuse without revealing anything about it.
  if (order.retailerId !== retailerId) return { outcome: "REJECTED" };
  return { outcome: "PLACED", orderId: order.id, number: order.number, status: order.status as "PENDING_REVIEW" | "CREDIT_HOLD", alreadyPlaced: true };
}

const notPlaced = (problem: NotPlacedProblem, preview: CartPreview): PlaceOrderResult => ({ outcome: "NOT_PLACED", problem, preview });

async function freshPreview(deps: Deps, viewer: Placer, input: PlaceOrderInput): Promise<CartPreview> {
  const tier = await deps.db.retailer.findUniqueOrThrow({ where: { id: viewer.retailerId }, select: { tier: { select: { discountBps: true } } } });
  return (await priceCart(deps, { id: viewer.retailerId, tierDiscountBps: tier.tier.discountBps }, input.lines)).preview;
}

function orderData(viewer: Placer, input: PlaceOrderInput, priced: PricedCart, status: "PENDING_REVIEW" | "CREDIT_HOLD", now: Date): Prisma.OrderUncheckedCreateInput {
  const { preview } = priced;
  const { totals, credit } = preview;
  const skuInfo = new Map(preview.lines.flatMap((l) => (l.status === "OK" ? [[l.skuId, l.sku] as const] : [])));
  return {
    clientRequestId: input.clientRequestId,
    retailerId: viewer.retailerId,
    placedById: viewer.userId,
    source: "CATALOGUE",
    status,
    taxablePaise: totals.taxablePaise,
    discountPaise: totals.discountPaise,
    gstPaise: totals.gstPaise,
    totalPaise: totals.totalPaise,
    originalTotalPaise: totals.totalPaise,
    creditLimitPaise: credit.limitPaise,
    availableCreditPaise: credit.availablePaise,
    overLimitPaise: credit.overByPaise,
    creditCheckedAt: now,
    placedAt: now,
    lines: {
      create: priced.okLines.map(({ line, selection }) => {
        const sku = skuInfo.get(line.skuId)!;
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
          offerSelection: selection,
        };
      }),
    },
    events: {
      create: [
        { type: "PLACED", actorId: viewer.userId, toStatus: status, payload: { confirmCreditHold: input.confirmCreditHold }, createdAt: now },
        ...(status === "CREDIT_HOLD"
          ? [{
              type: "STATUS_CHANGED" as const,
              actorId: null, // system (D21)
              toStatus: "CREDIT_HOLD" as const,
              reason: "Over available credit at placement",
              payload: { overByPaise: credit.overByPaise, availablePaise: credit.availablePaise, totalPaise: totals.totalPaise },
              createdAt: now,
            }]
          : []),
      ],
    },
  };
}
