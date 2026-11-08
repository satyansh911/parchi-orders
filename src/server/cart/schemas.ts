import { z } from "zod";
import { MAX_CASES_PER_LINE, MAX_LINES_PER_ORDER } from "@/domain/pricing/limits";

// Cart line input shared by preview and placement: strict at every level
// (D69.4: no retailerId or role can ride along), one line per SKU (D48),
// 1–999 whole cases (D45).
export const cartLineSchema = z.strictObject({
  skuId: z.string().min(1).max(40),
  paidCases: z.number().int().min(1).max(MAX_CASES_PER_LINE),
  choice: z.enum(["BEST", "WITHOUT_FREE_GOODS"]).optional(),
});

export const cartLinesSchema = z
  .array(cartLineSchema)
  .max(MAX_LINES_PER_ORDER)
  .refine((lines) => new Set(lines.map((l) => l.skuId)).size === lines.length, "duplicate SKU");
