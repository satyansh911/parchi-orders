// Ownership rules for every data read (D62, D69.1–5).
// - A retailer only ever sees rows with their own retailerId, taken from the
//   database-backed session, never from input.
// - The desk sees everything, but must name the retailer explicitly when an
//   operation concerns one.
// - Anything outside the viewer's reach is NOT_FOUND, never "forbidden",
//   so other retailers' records can't even be confirmed to exist.

import { AccessError } from "../auth/access-error";
import type { Viewer } from "../auth/session-store";

/** Prisma `where` fragment limiting a retailer to their own rows. */
export function ownedBy(viewer: Viewer): { retailerId?: string } {
  if (viewer.role === "DESK") return {};
  if (viewer.role === "RETAILER" && viewer.retailerId) return { retailerId: viewer.retailerId };
  throw new AccessError("NOT_FOUND");
}

/**
 * The retailer an operation is about.
 * Retailer: always their own; naming any other retailer is NOT_FOUND.
 * Desk: must name one explicitly (RETAILER_REQUIRED otherwise).
 */
export function targetRetailerId(viewer: Viewer, requested: string | undefined): string {
  if (viewer.role === "RETAILER") {
    if (!viewer.retailerId) throw new AccessError("NOT_FOUND");
    if (requested !== undefined && requested !== viewer.retailerId) throw new AccessError("NOT_FOUND");
    return viewer.retailerId;
  }
  // Salesmen reach a shop only through assertSalesmanShop (an async, DB-checked
  // assignment, D109); this synchronous helper never trusts them.
  if (viewer.role !== "DESK") throw new AccessError("NOT_FOUND");
  if (!requested) throw new AccessError("RETAILER_REQUIRED");
  return requested;
}

/** D109: the shop must be assigned to this salesman (checked in the database every time). */
export async function assertSalesmanShop(
  db: { retailer: { findFirst(args: { where: { id: string; salesmanId: string }; select: { id: true } }): Promise<{ id: string } | null> } },
  viewer: Viewer,
  retailerId: string,
): Promise<string> {
  if (viewer.role !== "SALESMAN") throw new AccessError("NOT_FOUND");
  const shop = await db.retailer.findFirst({ where: { id: retailerId, salesmanId: viewer.userId }, select: { id: true } });
  if (!shop) throw new AccessError("NOT_FOUND");
  return shop.id;
}
