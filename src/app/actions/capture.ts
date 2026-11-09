"use server";

import { z } from "zod";
import { action } from "@/server/auth/action";
import { confirmCapture, type ConfirmResult } from "@/server/capture/confirm";
import { interpretMessage, MAX_MESSAGE_CHARS, type InterpretResult } from "@/server/capture/interpret";
import { checkMedia, MAX_MEDIA_BYTES, type MediaProblem } from "@/server/capture/media";
import { providerFromEnv } from "@/server/capture/provider";
import { db } from "@/server/db";

/** Interpret a free-text order (D94). Never creates an order or reserves stock. */
export const interpretMessageAction = action({
  role: "RETAILER",
  input: z.object({ clientRequestId: z.uuid(), message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS) }),
  handler: async (input, { viewer }): Promise<InterpretResult> =>
    interpretMessage({ db, provider: providerFromEnv(), now: new Date() }, viewer, input),
});

/**
 * D111: a photo of a handwritten list or a voice note. The bytes are checked
 * (type allow-list, size, magic number) before anything reaches the model;
 * the media is never stored, only the transcript.
 */
export const interpretMediaAction = action({
  role: "RETAILER",
  input: z.object({
    clientRequestId: z.uuid(),
    kind: z.enum(["PHOTO", "VOICE"]),
    mimeType: z.string().min(3).max(100),
    data: z.string().min(1).max(Math.ceil((MAX_MEDIA_BYTES * 4) / 3) + 4),
  }),
  handler: async (input, { viewer }): Promise<InterpretResult | { outcome: "BAD_MEDIA"; problem: MediaProblem }> => {
    const checked = checkMedia(input.kind, input.mimeType, input.data);
    if (!checked.ok) return { outcome: "BAD_MEDIA", problem: checked.problem };
    return interpretMessage({ db, provider: providerFromEnv(), now: new Date() }, viewer, { clientRequestId: input.clientRequestId, media: checked.media });
  },
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
