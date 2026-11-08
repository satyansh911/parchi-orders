"use server";

import { z } from "zod";
import { action } from "@/server/auth/action";
import { db } from "@/server/db";
import { addNoteForDesk, cancelOwnOrder, requestCancellation } from "@/server/orders/retailer-order-actions";

const orderId = z.string().min(1).max(40);
const note = z.string().trim().min(1).max(300);

/** Cancel own PENDING_REVIEW order (D77). */
export const cancelOrderAction = action({
  role: "RETAILER",
  input: z.object({ orderId }),
  handler: async (input, { viewer }) => cancelOwnOrder(db, viewer, input.orderId, new Date()),
});

/** Ask the office to cancel a held or under-review order (D77). */
export const requestCancellationAction = action({
  role: "RETAILER",
  input: z.object({ orderId, note: note.optional() }),
  handler: async (input, { viewer }) => requestCancellation(db, viewer, input.orderId, input.note, new Date()),
});

/** Clarification note to the office on a held or under-review order (D23). */
export const addNoteAction = action({
  role: "RETAILER",
  input: z.object({ orderId, note }),
  handler: async (input, { viewer }) => addNoteForDesk(db, viewer, input.orderId, input.note, new Date()),
});
