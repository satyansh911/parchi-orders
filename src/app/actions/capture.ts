"use server";

import { z } from "zod";
import { action } from "@/server/auth/action";
import { confirmCapture, type ConfirmResult } from "@/server/capture/confirm";
import { interpretMessage, MAX_MESSAGE_CHARS, type InterpretResult } from "@/server/capture/interpret";
import { providerFromEnv } from "@/server/capture/provider";
import { db } from "@/server/db";

/** Interpret a free-text order (D94). Never creates an order or reserves stock. */
export const interpretMessageAction = action({
  role: "RETAILER",
  input: z.object({ clientRequestId: z.uuid(), message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS) }),
  handler: async (input, { viewer }): Promise<InterpretResult> =>
    interpretMessage({ db, provider: providerFromEnv(), now: new Date() }, viewer, input),
});

const id = z.string().min(1).max(40);

/** Confirm resolved lines (D92, D98). Idempotent; returns cart lines for the device cart. */
export const confirmCaptureAction = action({
  role: "RETAILER",
  input: z.object({
    captureId: id,
    lines: z
      .array(z.union([z.strictObject({ lineId: id, removed: z.literal(true) }), z.strictObject({ lineId: id.optional(), skuId: id, cases: z.number().int().min(1).max(999) })]))
      .max(30),
  }),
  handler: async (input, { viewer }): Promise<ConfirmResult> => confirmCapture(db, viewer, input.captureId, input.lines, new Date()),
});
