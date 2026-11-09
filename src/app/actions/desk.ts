"use server";

import { z } from "zod";
import { action } from "@/server/auth/action";
import { db } from "@/server/db";
import { editOrderLine } from "@/server/desk/edit-line";
import { createExportBatch } from "@/server/desk/export";
import { decideOrder } from "@/server/desk/transitions";

const id = z.string().min(1).max(40);
const version = z.number().int().min(0);

/** Approve / reject / cancel an approved order (D30). Reasons are checked by the status machine. */
export const decideOrderAction = action({
  role: "DESK",
  input: z.object({ orderId: id, version, decision: z.enum(["APPROVE", "REJECT", "CANCEL_APPROVED"]), reason: z.string().trim().max(300).optional() }),
  handler: async (input, { viewer }) => decideOrder(db, viewer, input, new Date()),
});

/** Change a line's paid cases; 0 removes it (D22). */
export const editOrderLineAction = action({
  role: "DESK",
  input: z.object({ orderId: id, version, lineId: id, paidCases: z.number().int().min(0).max(999) }),
  handler: async (input, { viewer }) => editOrderLine(db, viewer, input, new Date()),
});

/** Export every approved order not yet exported; the desk confirms the count and total it saw (D29). */
export const exportBatchAction = action({
  role: "DESK",
  input: z.object({ orderCount: z.number().int().min(1).max(10_000), totalPaise: z.number().int().min(0) }),
  handler: async (input, { viewer }) => createExportBatch(db, viewer, input, new Date()),
});
