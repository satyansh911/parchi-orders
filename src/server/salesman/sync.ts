// D108: one offline order arriving from a salesman's phone. The shop must be
// assigned to him (D109); then it is the normal placement transaction
// (idempotent request ID, retailer lock, re-pricing, credit, reservation),
// except that "what he saw" is the phone's computed expectation instead of a
// signed quote. Any difference → not placed, returned for re-confirmation.

import type { PrismaClient } from "@/generated/prisma/client";
import type { OfflineExpectation } from "@/domain/orders/offline-expectation";
import type { Viewer } from "../auth/session-store";
import { assertSalesmanShop } from "../data/scope";
import { placeOrder, type PlaceOrderResult } from "../orders/place-order";

export type SyncInput = {
  clientRequestId: string;
  retailerId: string;
  lines: { skuId: string; paidCases: number }[];
  expected: OfflineExpectation;
  confirmCreditHold: boolean;
  takenAt: Date;
};

export async function syncSalesmanOrder(deps: { db: PrismaClient; key: Buffer; now: Date }, viewer: Viewer, input: SyncInput): Promise<PlaceOrderResult> {
  const retailerId = await assertSalesmanShop(deps.db, viewer, input.retailerId);
  // A phone clock can be wrong; never record a "taken" time in the future.
  const takenAt = input.takenAt > deps.now ? deps.now : input.takenAt;
  return placeOrder(deps, { userId: viewer.userId, retailerId }, {
    clientRequestId: input.clientRequestId,
    lines: input.lines,
    expected: input.expected,
    confirmCreditHold: input.confirmCreditHold,
    source: "SALESMAN",
    takenAt,
  });
}
