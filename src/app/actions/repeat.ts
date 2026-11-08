"use server";

import { z } from "zod";
import { action } from "@/server/auth/action";
import { db } from "@/server/db";
import { repeatOrderLines, type RepeatLine } from "@/server/orders/repeat-order";

/** "Order again" (D9): lines of the retailer's own past order, re-priced later in the cart. */
export const repeatOrderAction = action({
  role: "RETAILER",
  input: z.object({ orderId: z.string().min(1).max(40) }),
  handler: async ({ orderId }, { viewer }): Promise<RepeatLine[]> => repeatOrderLines(db, viewer, orderId),
});
