import "server-only";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import type { Role } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { readSessionToken } from "./session-cookie";
import { findViewerByToken, type Viewer } from "./session-store";

/**
 * The current viewer, read from the database on every request (D58).
 * React's `cache` only de-duplicates calls within ONE request; nothing is
 * cached across requests, so logout and demotion apply immediately.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  // Request time only: never during a (runtime) prerender, which would also
  // read the clock ("new Date() while prerendering" in the live logs).
  await connection();
  return findViewerByToken(db, await readSessionToken(), new Date());
});

/**
 * For pages: not signed in → login (coming back here afterwards);
 * signed in with the wrong role → 404 (D62).
 */
export async function requirePageViewer(role: Role, currentPath: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  if (viewer.role !== role) notFound();
  return viewer;
}
