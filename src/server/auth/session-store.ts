// Database-backed sessions (D13, D57–D61).
// - Created at login with a fresh random token (no session fixation).
// - Fixed 7-day expiry from login, no renewal (D57).
// - Looked up on every request; the user's role and retailer always come from
//   the User row, never from the cookie or the request (D58, D69).
// - Several sessions per user are allowed; revoking one leaves the others (D61).
// The current time is passed in, so expiry is testable.

import type { PrismaClient } from "@/generated/prisma/client";
import type { Locale, Role } from "@/generated/prisma/enums";
import { generateSessionToken, hashSessionToken, isWellFormedToken } from "./tokens";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** The authenticated person, as resolved from the database on this request. */
export type Viewer = {
  userId: string;
  sessionId: string;
  name: string;
  role: Role;
  /** Set for retailers, null for desk users (CHECK in the database). */
  retailerId: string | null;
  locale: Locale;
};

type Db = Pick<PrismaClient, "session" | "$transaction">;

export async function createSession(db: Db, userId: string, now: Date): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.$transaction([
    // Housekeeping: drop this user's already-expired sessions.
    db.session.deleteMany({ where: { userId, expiresAt: { lte: now } } }),
    db.session.create({ data: { userId, tokenHash: hashSessionToken(token), expiresAt } }),
  ]);
  return { token, expiresAt };
}

/** Login on a device that may already hold a session: revoke that one, issue a new one. */
export async function rotateSession(
  db: Db,
  previousToken: string | undefined,
  userId: string,
  now: Date,
): Promise<{ token: string; expiresAt: Date }> {
  if (previousToken) await revokeSession(db, previousToken);
  return createSession(db, userId, now);
}

/** The viewer for a cookie token, or null if missing, malformed, unknown or expired. */
export async function findViewerByToken(db: Db, token: string | undefined, now: Date): Promise<Viewer | null> {
  if (!isWellFormedToken(token)) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: { select: { id: true, name: true, role: true, retailerId: true, locale: true } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= now.getTime()) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  const { user } = session;
  return { userId: user.id, sessionId: session.id, name: user.name, role: user.role, retailerId: user.retailerId, locale: user.locale };
}

/** Logout: revoke only the session this token belongs to (D61). */
export async function revokeSession(db: Db, token: string): Promise<void> {
  if (!isWellFormedToken(token)) return;
  await db.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}
