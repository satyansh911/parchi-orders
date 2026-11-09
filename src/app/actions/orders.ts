"use server";

import { z } from "zod";
import { action } from "@/server/auth/action";
import { quoteKeyFromEnv } from "@/server/cart/quote";
import { cartLinesSchema } from "@/server/cart/schemas";
import { db } from "@/server/db";
import { placeOrder, type PlaceOrderResult } from "@/server/orders/place-order";

/**
 * Place an order (D16, D75, D76, D79). The retailer comes from the session;
 * the server re-prices everything and only uses the quote to check that the
 * retailer saw exactly what will be charged.
 */
export const placeOrderAction = action({
  role: "RETAILER",
  input: z.object({
    clientRequestId: z.uuid(),
    lines: cartLinesSchema.min(1),
    quote: z.string().min(1).max(2_000),
    confirmCreditHold: z.boolean(),
    captureId: z.string().min(1).max(40).optional(),
  }),
  handler: async (input, { viewer }): Promise<PlaceOrderResult> => {
    const key = quoteKeyFromEnv();
    if (!key) throw new Error("QUOTE_SIGNING_KEY is not configured"); // fail closed (D75)
    return placeOrder({ db, key, now: new Date() }, { userId: viewer.userId, retailerId: viewer.retailerId }, input);
  },
});
