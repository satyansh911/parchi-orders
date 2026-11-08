// Session lifecycle on real Postgres (test branch only, D49).
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeDeskUser, makeRetailer } from "../testing/fixtures";
import { createTestClient, resetTestDatabase, resolveTestDatabaseUrl } from "../testing/test-database";
import { SESSION_TTL_MS, createSession, findViewerByToken, revokeSession, rotateSession } from "./session-store";
import { generateSessionToken, hashSessionToken } from "./tokens";

const db = createTestClient(resolveTestDatabaseUrl());
afterAll(() => db.$disconnect());
beforeEach(() => resetTestDatabase(db));

const NOW = new Date("2026-11-08T10:00:00Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);

describe("createSession", () => {
  it("stores only the SHA-256 hash of the token, never the token", async () => {
    const { user } = await makeRetailer(db, "R-A", "9999900101");
    const { token, expiresAt } = await createSession(db, user.id, NOW);
    const rows = await db.session.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashSessionToken(token));
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(expiresAt.toISOString()).toBe("2026-11-15T10:00:00.000Z"); // exactly 7 days (D57)
  });

  it("removes the user's already-expired sessions as housekeeping", async () => {
    const { user } = await makeRetailer(db, "R-A", "9999900101");
    await createSession(db, user.id, NOW);
    await createSession(db, user.id, later(SESSION_TTL_MS + 1));
    expect(await db.session.count()).toBe(1);
  });
});

describe("findViewerByToken", () => {
  it("resolves role and retailer from the database", async () => {
    const { user, retailer } = await makeRetailer(db, "R-A", "9999900101");
    const { token } = await createSession(db, user.id, NOW);
    expect(await findViewerByToken(db, token, NOW)).toMatchObject({ userId: user.id, role: "RETAILER", retailerId: retailer.id, locale: "HI" });
  });

  it("returns null for missing, malformed, random and tampered tokens", async () => {
    const { user } = await makeRetailer(db, "R-A", "9999900101");
    const { token } = await createSession(db, user.id, NOW);
    const tampered = token.slice(0, 5) + (token[5] === "A" ? "B" : "A") + token.slice(6); // one character changed
    for (const bad of [undefined, "", "not-a-token", generateSessionToken(), tampered]) {
      expect(await findViewerByToken(db, bad, NOW)).toBeNull();
    }
  });

  it("does not accept the stored hash as a token", async () => {
    const { user } = await makeRetailer(db, "R-A", "9999900101");
    const { token } = await createSession(db, user.id, NOW);
    expect(await findViewerByToken(db, hashSessionToken(token), NOW)).toBeNull();
  });

  it("accepts a session until just before 7 days, and rejects and deletes it at 7 days (D57)", async () => {
    const { user } = await makeRetailer(db, "R-A", "9999900101");
    const { token } = await createSession(db, user.id, NOW);
    expect(await findViewerByToken(db, token, later(SESSION_TTL_MS - 1))).not.toBeNull();
    expect(await findViewerByToken(db, token, later(SESSION_TTL_MS))).toBeNull();
    expect(await db.session.count()).toBe(0);
  });

  it("does not renew on use: a session used daily still expires 7 days after login", async () => {
    const { user } = await makeRetailer(db, "R-A", "9999900101");
    const { token } = await createSession(db, user.id, NOW);
    for (let day = 1; day <= 6; day++) await findViewerByToken(db, token, later(day * 24 * 3600 * 1000));
    expect(await findViewerByToken(db, token, later(SESSION_TTL_MS))).toBeNull();
  });

  it("reflects a role change on the very next lookup (D58)", async () => {
    const desk = await makeDeskUser(db);
    const { token } = await createSession(db, desk.id, NOW);
    expect((await findViewerByToken(db, token, NOW))?.role).toBe("DESK");
    const { retailer } = await makeRetailer(db, "R-A", "9999900101");
    await db.user.update({ where: { id: desk.id }, data: { role: "RETAILER", retailerId: retailer.id } });
    expect(await findViewerByToken(db, token, NOW)).toMatchObject({ role: "RETAILER", retailerId: retailer.id });
  });

  it("logs a user out when the user is deleted (sessions cascade)", async () => {
    const desk = await makeDeskUser(db);
    const { token } = await createSession(db, desk.id, NOW);
    await db.user.delete({ where: { id: desk.id } });
    expect(await findViewerByToken(db, token, NOW)).toBeNull();
  });
});

describe("multiple sessions, revocation and rotation (D61)", () => {
  it("allows several devices; logout revokes only the current one", async () => {
    const { user } = await makeRetailer(db, "R-A", "9999900101");
    const phone = await createSession(db, user.id, NOW);
    const shopPc = await createSession(db, user.id, NOW);
    await revokeSession(db, phone.token);
    expect(await findViewerByToken(db, phone.token, NOW)).toBeNull();
    expect(await findViewerByToken(db, shopPc.token, NOW)).not.toBeNull();
  });

  it("rejects a revoked token if it is replayed", async () => {
    const { user } = await makeRetailer(db, "R-A", "9999900101");
    const { token } = await createSession(db, user.id, NOW);
    await revokeSession(db, token);
    await revokeSession(db, token); // idempotent
    expect(await findViewerByToken(db, token, NOW)).toBeNull();
  });

  it("rotates on login: the device's previous token stops working, the new one works", async () => {
    const { user } = await makeRetailer(db, "R-A", "9999900101");
    const first = await createSession(db, user.id, NOW);
    const second = await rotateSession(db, first.token, user.id, NOW);
    expect(second.token).not.toBe(first.token);
    expect(await findViewerByToken(db, first.token, NOW)).toBeNull();
    expect(await findViewerByToken(db, second.token, NOW)).not.toBeNull();
    expect(await db.session.count()).toBe(1);
  });

  it("rotating with another user's token doesn't affect that user beyond revoking the presented token", async () => {
    const a = await makeRetailer(db, "R-A", "9999900101");
    const b = await makeRetailer(db, "R-B", "9999900102");
    const bOther = await createSession(db, b.user.id, NOW);
    const aNew = await rotateSession(db, undefined, a.user.id, NOW);
    expect(await findViewerByToken(db, bOther.token, NOW)).not.toBeNull();
    expect((await findViewerByToken(db, aNew.token, NOW))?.userId).toBe(a.user.id);
  });
});
