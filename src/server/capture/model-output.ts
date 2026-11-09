// The ONLY shape accepted from the model (D94). Types and ranges are checked;
// unknown keys (e.g. an injected "price") are discarded and never used. There
// is no price, stock or scheme field: the model cannot even express them.

import { z } from "zod";
import type { ModelOutput } from "@/domain/capture/postprocess";

const line = z.object({
  raw: z.string().max(300),
  sku: z.string().max(10).nullable(),
  qty: z.number().int().min(0).max(100_000).nullable(),
  unit: z.enum(["CASE", "PIECE", "UNKNOWN"]),
  score: z.number().min(0).max(100),
  alternatives: z.array(z.string().max(10)).max(5),
  note: z.string().max(500).optional(),
});

export const modelOutputSchema = z.object({
  lines: z.array(line).max(60),
  unmatched: z.array(z.string().max(300)).max(30),
});

/** Same shape as JSON Schema, for the provider's structured-output mode. */
export const MODEL_OUTPUT_JSON_SCHEMA = {
  type: "object",
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          raw: { type: "string", description: "The retailer's exact words for this item, copied from the message." },
          sku: { type: ["string", "null"], description: "Catalogue short ID like S12, or null if no product fits." },
          qty: { type: ["integer", "null"], description: "The quantity exactly as written, or null if none." },
          unit: { type: "string", enum: ["CASE", "PIECE", "UNKNOWN"] },
          score: { type: "number", minimum: 0, maximum: 100, description: "How sure you are of the product (0–100)." },
          alternatives: { type: "array", items: { type: "string" }, description: "Up to two other plausible short IDs." },
          note: { type: "string" },
        },
        required: ["raw", "sku", "qty", "unit", "score", "alternatives"],
      },
    },
    unmatched: { type: "array", items: { type: "string" }, description: "Words that look like items but match nothing." },
  },
  required: ["lines", "unmatched"],
} as const;

export type ParsedModelOutput = { ok: true; output: ModelOutput } | { ok: false; reason: "INVALID_JSON" | "EMPTY" };

export function parseModelOutput(text: string | undefined | null): ParsedModelOutput {
  if (!text || !text.trim()) return { ok: false, reason: "EMPTY" };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: "INVALID_JSON" };
  }
  const parsed = modelOutputSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "INVALID_JSON" };
  if (parsed.data.lines.length === 0 && parsed.data.unmatched.length === 0) return { ok: false, reason: "EMPTY" };
  return { ok: true, output: parsed.data };
}
