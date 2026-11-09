// D110: orders to load on a given IST day — APPROVED or EXPORTED orders
// approved that day (exporting to Tally doesn't stop them shipping). Desk only.

import type { PrismaClient } from "@/generated/prisma/client";
import { buildLoadingLists } from "@/domain/loading/loading-list";
import { istDayRange } from "@/domain/schemes/validity";
import { AccessError } from "../auth/access-error";
import type { Viewer } from "../auth/session-store";

export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function istToday(now: Date): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

export async function vanLoadingLists(db: PrismaClient, viewer: Viewer, day: string) {
  if (viewer.role !== "DESK") throw new AccessError("NOT_FOUND");
  const { startsAt, endsAt } = istDayRange(day, day);
  const orders = await db.order.findMany({
    where: { status: { in: ["APPROVED", "EXPORTED"] }, approvedAt: { gte: startsAt, lt: endsAt } },
    select: {
      number: true, totalPaise: true,
      retailer: { select: { code: true, shopName: true, area: true, van: { select: { code: true, name: true } } } },
      lines: { select: { skuCode: true, nameEn: true, paidCases: true, freeCases: true } },
    },
  });
  return buildLoadingLists(orders.map((o) => ({ number: o.number, totalPaise: o.totalPaise, van: o.retailer.van, retailer: o.retailer, lines: o.lines })));
}
