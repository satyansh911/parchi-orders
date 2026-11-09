// Desk-verified aliases (D28, brief: "desk corrections become aliases for
// that retailer"). Only the desk can save one, only from a confirmed capture
// line's own words and the product it was resolved to. Future captures for
// that retailer then map the same words straight to that product (D97).

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { aliasKey } from "@/domain/capture/text";
import { AccessError } from "../auth/access-error";
import type { DeskActor } from "./lock";

export type SaveAliasResult = { outcome: "SAVED" | "UPDATED" | "UNCHANGED"; phrase: string };

export async function saveAliasFromCaptureLine(db: PrismaClient, desk: DeskActor, captureLineId: string): Promise<SaveAliasResult> {
  const line = await db.captureLine.findUnique({
    where: { id: captureLineId },
    select: { raw: true, resolution: true, resolvedSkuId: true, flags: true, capture: { select: { retailerId: true, status: true } } },
  });
  if (!line) throw new AccessError("NOT_FOUND");
  const usable = line.capture.status === "CONFIRMED" && (line.resolution === "ACCEPTED" || line.resolution === "CORRECTED") && line.resolvedSkuId && !line.flags.includes("MANUAL");
  const phrase = aliasKey(line.raw);
  if (!usable || !phrase) throw new AccessError("NOT_ALLOWED");
  const sku = await db.sku.findUnique({ where: { id: line.resolvedSkuId! }, select: { active: true } });
  if (!sku?.active) throw new AccessError("NOT_ALLOWED");

  const key = { retailerId_phraseNormalized: { retailerId: line.capture.retailerId, phraseNormalized: phrase } };
  const existing = await db.alias.findUnique({ where: key, select: { skuId: true } });
  if (existing?.skuId === line.resolvedSkuId) return { outcome: "UNCHANGED", phrase };
  try {
    await db.alias.upsert({
      where: key,
      create: { retailerId: line.capture.retailerId, phraseNormalized: phrase, skuId: line.resolvedSkuId!, createdById: desk.userId },
      update: { skuId: line.resolvedSkuId!, createdById: desk.userId },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { outcome: "UNCHANGED", phrase };
    throw error;
  }
  return { outcome: existing ? "UPDATED" : "SAVED", phrase };
}
