// AI captures, scoped to the viewer (D62, D69.3). A capture belongs to the
// retailer it is for, whoever created it (retailer or desk, A.7).

import type { PrismaClient } from "@/generated/prisma/client";
import { AccessError } from "../auth/access-error";
import type { Viewer } from "../auth/session-store";
import { ownedBy } from "./scope";

export async function getCapture(db: PrismaClient, viewer: Viewer, captureId: string) {
  const capture = await db.capture.findFirst({
    where: { id: captureId, ...ownedBy(viewer) },
    include: { lines: { orderBy: { position: "asc" } } },
  });
  if (!capture) throw new AccessError("NOT_FOUND");
  return capture;
}
