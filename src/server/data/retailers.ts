// A retailer's account: profile, price tier ("his price", D5) and credit
// figures (A.6). Visible only to that retailer and the desk (brief privacy rule).
// Never cached on the server (D69.10).

import type { PrismaClient } from "@/generated/prisma/client";
import { AccessError } from "../auth/access-error";
import type { Viewer } from "../auth/session-store";
import { targetRetailerId } from "./scope";

export type RetailerAccount = {
  id: string;
  code: string;
  shopName: string;
  ownerName: string;
  area: string;
  tier: { code: string; name: string; discountBps: number };
  creditLimitPaise: number;
  outstandingPaise: number;
};

export async function getRetailerAccount(db: PrismaClient, viewer: Viewer, retailerId?: string): Promise<RetailerAccount> {
  const id = targetRetailerId(viewer, retailerId);
  const row = await db.retailer.findUnique({
    where: { id },
    select: {
      id: true, code: true, shopName: true, ownerName: true, area: true,
      creditLimitPaise: true, outstandingPaise: true,
      tier: { select: { code: true, name: true, discountBps: true } },
    },
  });
  if (!row) throw new AccessError("NOT_FOUND");
  return row;
}

/** The tier discount used to price the catalogue for this retailer (D5). */
export async function getPricingTier(db: PrismaClient, viewer: Viewer, retailerId?: string): Promise<RetailerAccount["tier"]> {
  return (await getRetailerAccount(db, viewer, retailerId)).tier;
}

/** Desk only: every retailer, for choosing whom an order or capture is for. */
export async function listRetailers(db: PrismaClient, viewer: Viewer) {
  if (viewer.role !== "DESK") throw new AccessError("NOT_FOUND");
  return db.retailer.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, shopName: true, area: true },
  });
}
