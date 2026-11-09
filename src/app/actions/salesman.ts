"use server";

import { z } from "zod";
import { action } from "@/server/auth/action";
import { quoteKeyFromEnv } from "@/server/cart/quote";
import { db } from "@/server/db";
import { buildSalesmanPack } from "@/server/salesman/pack";
import { syncSalesmanOrder } from "@/server/salesman/sync";

/** D108: download the offline pack (his shops only, D109). */
export const salesmanPackAction = action({
  role: "SALESMAN",
  input: z.object({}),
  handler: async (_input, { viewer }) => buildSalesmanPack(db, viewer, new Date()),
});

const id = z.string().min(1).max(40);
const expectedLine = z.strictObject({ skuId: id, paidCases: z.number().int().min(1).max(999), freeCases: z.number().int().min(0).max(999), lineTotalPaise: z.number().int().min(0) });

/** D108: send one order taken (possibly offline) on the phone. Idempotent by request ID. */
export const syncSalesmanOrderAction = action({
  role: "SALESMAN",
  input: z.object({
    clientRequestId: z.uuid(),
    retailerId: id,
    lines: z.array(z.strictObject({ skuId: id, paidCases: z.number().int().min(1).max(999) })).min(1).max(50),
    expected: z.strictObject({ lines: z.array(expectedLine).max(50), totalPaise: z.number().int().min(0), hold: z.boolean() }),
    confirmCreditHold: z.boolean(),
    takenAt: z.iso.datetime(),
  }),
  handler: async (input, { viewer }) => {
    const key = quoteKeyFromEnv();
    if (!key) throw new Error("QUOTE_SIGNING_KEY is not configured");
    return syncSalesmanOrder({ db, key, now: new Date() }, viewer, { ...input, takenAt: new Date(input.takenAt) });
  },
});
