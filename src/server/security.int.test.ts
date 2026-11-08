// Attack tests (D62, D67, D69): cross-retailer access and role escalation,
// end to end through real sessions, the real action wrapper and the real
// data-access layer, on the test branch only (D49).
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createActionFactory } from "./auth/action-core";
import { createSession, findViewerByToken, revokeSession, SESSION_TTL_MS } from "./auth/session-store";
import { getCapture } from "./data/captures";
import { getOrder, listOrders } from "./data/orders";
import { getPricingTier, getRetailerAccount, listRetailers } from "./data/retailers";
import { makeCapture, makeDeskUser, makeOrder, makeRetailer } from "./testing/fixtures";
import { createTestClient, resetTestDatabase, resolveTestDatabaseUrl } from "./testing/test-database";

const db = createTestClient(resolveTestDatabaseUrl());
afterAll(() => db.$disconnect());

let now = new Date("2026-11-09T10:00:00Z");
let currentToken: string | undefined;
const action = createActionFactory({ resolveViewer: () => findViewerByToken(db, currentToken, now) });

// Actions as the app will build them: wrapper + data-access layer.
const myOrder = action({ role: "RETAILER", input: z.object({ orderId: z.string() }), handler: (i, { viewer }) => getOrder(db, viewer, i.orderId) });
const myOrders = action({ role: "RETAILER", input: z.object({}), handler: (_i, { viewer }) => listOrders(db, viewer) });
const myAccount = action({ role: "RETAILER", input: z.object({}), handler: (_i, { viewer }) => getRetailerAccount(db, viewer) });
const myCapture = action({ role: "RETAILER", input: z.object({ captureId: z.string() }), handler: (i, { viewer }) => getCapture(db, viewer, i.captureId) });
const deskRetailer = action({ role: "DESK", input: z.object({ retailerId: z.string() }), handler: (i, { viewer }) => getRetailerAccount(db, viewer, i.retailerId) });
const deskOrders = action({ role: "DESK", input: z.object({ retailerId: z.string().optional() }), handler: (i, { viewer }) => listOrders(db, viewer, { retailerId: i.retailerId }) });
const deskOrder = action({ role: "DESK", input: z.object({ orderId: z.string() }), handler: (i, { viewer }) => getOrder(db, viewer, i.orderId) });

let A: Awaited<ReturnType<typeof makeRetailer>>;
let B: Awaited<ReturnType<typeof makeRetailer>>;
let deskUser: Awaited<ReturnType<typeof makeDeskUser>>;
let orderA: { id: string };
let orderB: { id: string };
let captureA: { id: string };
let captureB: { id: string };
let tokenA: string;
let tokenB: string;
let tokenDesk: string;

const as = (token: string | undefined) => { currentToken = token; };
const viewerFor = async (token: string) => (await findViewerByToken(db, token, now))!;

beforeEach(async () => {
  await resetTestDatabase(db);
  now = new Date("2026-11-09T10:00:00Z");
  A = await makeRetailer(db, "R-A", "9999900101", { tierCode: "STANDARD", tierDiscountBps: 0, creditLimitPaise: 10_000_000, outstandingPaise: 3_240_000 });
  B = await makeRetailer(db, "R-B", "9999900102", { tierCode: "KEY_ACCOUNT", tierDiscountBps: 200, creditLimitPaise: 30_000_000, outstandingPaise: 11_800_000 });
  deskUser = await makeDeskUser(db);
  orderA = await makeOrder(db, A.retailer.id, A.user.id, "A1");
  orderB = await makeOrder(db, B.retailer.id, B.user.id, "B1");
  captureA = await makeCapture(db, A.retailer.id, A.user.id, "5 peti biscuit");
  captureB = await makeCapture(db, B.retailer.id, deskUser.id, "2 peti washing powder");
  tokenA = (await createSession(db, A.user.id, now)).token;
  tokenB = (await createSession(db, B.user.id, now)).token;
  tokenDesk = (await createSession(db, deskUser.id, now)).token;
});

describe("cross-retailer access: retailer A against retailer B's data", () => {
  it("reads A's own order, but B's order is NOT_FOUND", async () => {
    as(tokenA);
    expect(await myOrder({ orderId: orderA.id })).toMatchObject({ ok: true, data: { id: orderA.id } });
    expect(await myOrder({ orderId: orderB.id })).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("gives the same answer for B's real order as for an id that doesn't exist (no existence oracle)", async () => {
    as(tokenA);
    expect(await myOrder({ orderId: orderB.id })).toEqual(await myOrder({ orderId: "does-not-exist" }));
  });

  it("lists only A's orders", async () => {
    as(tokenA);
    const result = await myOrders({});
    expect(result.ok && result.data.map((o) => o.retailerId)).toEqual([A.retailer.id]);
  });

  it("refuses to let A name B as the retailer, at the wrapper (unknown key) and in the data layer", async () => {
    as(tokenA);
    expect(await myOrders({ retailerId: B.retailer.id })).toEqual({ ok: false, error: "INVALID_INPUT" });
    expect(await myOrder({ orderId: orderB.id, retailerId: B.retailer.id })).toEqual({ ok: false, error: "INVALID_INPUT" });
    const viewerA = await viewerFor(tokenA);
    await expect(listOrders(db, viewerA, { retailerId: B.retailer.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getRetailerAccount(db, viewerA, B.retailer.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("shows A only A's own credit figures", async () => {
    as(tokenA);
    expect(await myAccount({})).toMatchObject({ ok: true, data: { id: A.retailer.id, creditLimitPaise: 10_000_000, outstandingPaise: 3_240_000 } });
  });

  it("prices A at A's tier and B at B's tier, never each other's", async () => {
    expect(await getPricingTier(db, await viewerFor(tokenA))).toMatchObject({ code: "STANDARD", discountBps: 0 });
    expect(await getPricingTier(db, await viewerFor(tokenB))).toMatchObject({ code: "KEY_ACCOUNT", discountBps: 200 });
    await expect(getPricingTier(db, await viewerFor(tokenA), B.retailer.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("reads A's own capture, but B's capture (even one the desk created for B) is NOT_FOUND", async () => {
    as(tokenA);
    expect(await myCapture({ captureId: captureA.id })).toMatchObject({ ok: true, data: { rawText: "5 peti biscuit" } });
    expect(await myCapture({ captureId: captureB.id })).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("hides the desk's internal audit trail from retailers", async () => {
    as(tokenA);
    const result = await myOrder({ orderId: orderA.id });
    expect(result.ok && "events" in result.data && result.data.events).toBeFalsy();
  });
});

describe("role escalation attempts", () => {
  it("a retailer calling desk actions gets NOT_FOUND, and the handler never runs", async () => {
    as(tokenA);
    expect(await deskRetailer({ retailerId: B.retailer.id })).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(await deskOrders({})).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(await deskOrder({ orderId: orderB.id })).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("a retailer calling desk-only data functions directly is refused", async () => {
    await expect(listRetailers(db, await viewerFor(tokenA))).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("claiming a role or identity in the input is rejected", async () => {
    as(tokenA);
    expect(await myOrders({ role: "DESK" })).toEqual({ ok: false, error: "INVALID_INPUT" });
    expect(await myOrders({ userId: deskUser.id })).toEqual({ ok: false, error: "INVALID_INPUT" });
    expect(await deskOrders({ role: "DESK" })).toEqual({ ok: false, error: "NOT_FOUND" }); // role check comes first
  });

  it("a cookie holding a user id, a session id or a token hash is not a session", async () => {
    const session = await db.session.findFirstOrThrow({ where: { userId: deskUser.id } });
    for (const forged of [deskUser.id, session.id, session.tokenHash]) {
      as(forged);
      expect(await deskOrders({})).toEqual({ ok: false, error: "UNAUTHENTICATED" });
    }
  });

  it("demoting a desk user takes effect on their very next request (D58, D69.8)", async () => {
    as(tokenDesk);
    expect(await deskOrders({})).toMatchObject({ ok: true });
    await db.user.update({ where: { id: deskUser.id }, data: { role: "RETAILER", retailerId: A.retailer.id } });
    expect(await deskOrders({})).toEqual({ ok: false, error: "NOT_FOUND" });
    const own = await myOrders({});
    expect(own.ok && own.data.map((o) => o.retailerId)).toEqual([A.retailer.id]); // now limited to A's data only
  });

  it("moving a retailer user to another shop changes their scope on the next request", async () => {
    as(tokenA);
    await db.user.update({ where: { id: A.user.id }, data: { retailerId: B.retailer.id } });
    const result = await myOrders({});
    expect(result.ok && result.data.map((o) => o.retailerId)).toEqual([B.retailer.id]);
  });

  it("a logged-out or expired session can't be used for anything", async () => {
    as(tokenA);
    await revokeSession(db, tokenA);
    expect(await myOrders({})).toEqual({ ok: false, error: "UNAUTHENTICATED" });
    as(tokenDesk);
    now = new Date(now.getTime() + SESSION_TTL_MS);
    expect(await deskOrders({})).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });
});

describe("desk access with explicit retailer ids (D69.5)", () => {
  it("reads any retailer's account when it names the retailer", async () => {
    as(tokenDesk);
    expect(await deskRetailer({ retailerId: B.retailer.id })).toMatchObject({ ok: true, data: { id: B.retailer.id, tier: { code: "KEY_ACCOUNT" } } });
    expect(await deskRetailer({ retailerId: A.retailer.id })).toMatchObject({ ok: true, data: { id: A.retailer.id } });
  });

  it("must name a retailer: omitting it is RETAILER_REQUIRED, not 'all'", async () => {
    await expect(getRetailerAccount(db, await viewerFor(tokenDesk))).rejects.toMatchObject({ code: "RETAILER_REQUIRED" });
  });

  it("an unknown retailer id is NOT_FOUND", async () => {
    as(tokenDesk);
    expect(await deskRetailer({ retailerId: "no-such-retailer" })).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("sees every order, can filter by retailer, and sees the audit trail", async () => {
    as(tokenDesk);
    const all = await deskOrders({});
    expect(all.ok && all.data.map((o) => o.retailerId).sort()).toEqual([A.retailer.id, B.retailer.id].sort());
    const onlyB = await deskOrders({ retailerId: B.retailer.id });
    expect(onlyB.ok && onlyB.data.map((o) => o.id)).toEqual([orderB.id]);
    const detail = await deskOrder({ orderId: orderA.id });
    expect(detail.ok && "events" in detail.data && detail.data.events).toHaveLength(1);
  });

  it("reads any retailer's capture and lists all retailers", async () => {
    const desk = await viewerFor(tokenDesk);
    expect((await getCapture(db, desk, captureB.id)).rawText).toBe("2 peti washing powder");
    expect((await listRetailers(db, desk)).map((r) => r.code)).toEqual(["R-A", "R-B"]);
  });
});
