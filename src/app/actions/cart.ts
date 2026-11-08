"use server";

import { z } from "zod";
import { action } from "@/server/auth/action";
import { priceCart, type CartPreview } from "@/server/cart/price-cart";
import { quoteKeyFromEnv } from "@/server/cart/quote";
import { cartLinesSchema } from "@/server/cart/schemas";
import { getPricingTier } from "@/server/data/retailers";
import { db } from "@/server/db";

/** Server-side cart preview (D74): prices, schemes, stock, nudge, credit, signed quote. */
export const previewCartAction = action({
  role: "RETAILER",
  input: z.object({ lines: cartLinesSchema }),
  handler: async ({ lines }, { viewer }): Promise<CartPreview> => {
    const key = quoteKeyFromEnv();
    if (!key) throw new Error("QUOTE_SIGNING_KEY is not configured"); // fail closed (D75)
    const tier = await getPricingTier(db, viewer);
    const { preview } = await priceCart({ db, key, now: new Date() }, { id: viewer.retailerId, tierDiscountBps: tier.discountBps }, lines);
    return preview;
  },
});
