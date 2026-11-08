import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AccessError } from "./access-error";
import { ACTION_MARK, createActionFactory, isGuardedAction } from "./action-core";
import type { Viewer } from "./session-store";

const retailer: Viewer = { userId: "u1", sessionId: "s1", name: "A", role: "RETAILER", retailerId: "r1", locale: "HI" };
const desk: Viewer = { userId: "u2", sessionId: "s2", name: "D", role: "DESK", retailerId: null, locale: "EN" };

function setup(viewer: Viewer | null) {
  const onUnauthenticated = vi.fn(async () => {});
  const action = createActionFactory({ resolveViewer: async () => viewer, onUnauthenticated });
  const handler = vi.fn(async (input: { orderId: string }, ctx: { viewer: unknown }) => ({ input, viewer: ctx.viewer }));
  return { action, handler, onUnauthenticated };
}

describe("action wrapper: authentication and role (D62, D67)", () => {
  it("runs a RETAILER action for a retailer, passing the database viewer", async () => {
    const { action, handler } = setup(retailer);
    const getOrder = action({ role: "RETAILER", input: z.object({ orderId: z.string() }), handler });
    expect(await getOrder({ orderId: "o1" })).toEqual({ ok: true, data: { input: { orderId: "o1" }, viewer: retailer } });
  });

  it("refuses a signed-out caller with UNAUTHENTICATED, clears the cookie, and never runs the handler", async () => {
    const { action, handler, onUnauthenticated } = setup(null);
    const getOrder = action({ role: "RETAILER", input: z.object({ orderId: z.string() }), handler });
    expect(await getOrder({ orderId: "o1" })).toEqual({ ok: false, error: "UNAUTHENTICATED" });
    expect(onUnauthenticated).toHaveBeenCalledOnce();
    expect(handler).not.toHaveBeenCalled();
  });

  it("checks authentication before input, so anonymous callers learn nothing about validation", async () => {
    const { action, handler } = setup(null);
    const getOrder = action({ role: "RETAILER", input: z.object({ orderId: z.string() }), handler });
    expect(await getOrder({ nonsense: true })).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });

  it("answers NOT_FOUND to the wrong role: a retailer calling a desk action, or the desk a retailer action", async () => {
    const asRetailer = setup(retailer);
    const deskOnly = asRetailer.action({ role: "DESK", input: z.object({ orderId: z.string() }), handler: asRetailer.handler });
    expect(await deskOnly({ orderId: "o1" })).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(asRetailer.handler).not.toHaveBeenCalled();

    const asDesk = setup(desk);
    const retailerOnly = asDesk.action({ role: "RETAILER", input: z.object({ orderId: z.string() }), handler: asDesk.handler });
    expect(await retailerOnly({ orderId: "o1" })).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("treats a 'retailer' with no retailer link as the wrong role", async () => {
    const { action, handler } = setup({ ...retailer, retailerId: null });
    const a = action({ role: "RETAILER", input: z.object({ orderId: z.string() }), handler });
    expect(await a({ orderId: "o1" })).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("lets PUBLIC actions run signed out, and SIGNED_IN actions run for any role", async () => {
    const anon = setup(null);
    const pub = anon.action({ role: "PUBLIC", input: z.object({ orderId: z.string() }), handler: anon.handler });
    expect(await pub({ orderId: "o1" })).toMatchObject({ ok: true });
    const asDesk = setup(desk);
    const any = asDesk.action({ role: "SIGNED_IN", input: z.object({ orderId: z.string() }), handler: asDesk.handler });
    expect(await any({ orderId: "o1" })).toMatchObject({ ok: true });
  });
});

describe("action wrapper: strict input (D69.4)", () => {
  it.each([{ retailerId: "r2" }, { role: "DESK" }, { userId: "u2" }, { extra: 1 }])(
    "rejects an unknown key %j even from a signed-in retailer, without running the handler",
    async (extra) => {
      const { action, handler } = setup(retailer);
      const getOrder = action({ role: "RETAILER", input: z.object({ orderId: z.string() }), handler });
      expect(await getOrder({ orderId: "o1", ...extra })).toEqual({ ok: false, error: "INVALID_INPUT" });
      expect(handler).not.toHaveBeenCalled();
    },
  );

  it("forces strictness even when given a non-strict schema", async () => {
    const { action, handler } = setup(retailer);
    const loose = action({ role: "RETAILER", input: z.looseObject({ orderId: z.string() }), handler });
    expect(await loose({ orderId: "o1", retailerId: "r2" })).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  it("rejects non-object input", async () => {
    const { action, handler } = setup(retailer);
    const a = action({ role: "RETAILER", input: z.object({ orderId: z.string() }), handler });
    for (const bad of [null, "o1", 42, ["o1"]]) expect(await a(bad)).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  it("accepts form posts, ignoring Next's own $ACTION fields but not other extra fields", async () => {
    const { action, handler } = setup(retailer);
    const a = action({ role: "RETAILER", input: z.object({ orderId: z.string() }), handler });
    const form = new FormData();
    form.set("orderId", "o1");
    form.set("$ACTION_ID_abc", "");
    expect(await a(form)).toMatchObject({ ok: true, data: { input: { orderId: "o1" } } });
    form.set("retailerId", "r2");
    expect(await a(form)).toEqual({ ok: false, error: "INVALID_INPUT" });
  });
});

describe("action wrapper: errors and marking", () => {
  it("turns AccessError from the data layer into a result", async () => {
    const { action } = setup(retailer);
    const a = action({ role: "RETAILER", input: z.object({}), handler: async () => { throw new AccessError("NOT_FOUND"); } });
    expect(await a({})).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("lets every other error propagate (e.g. Next.js redirects)", async () => {
    const { action } = setup(retailer);
    const boom = new Error("NEXT_REDIRECT");
    const a = action({ role: "RETAILER", input: z.object({}), handler: async () => { throw boom; } });
    await expect(a({})).rejects.toBe(boom);
  });

  it("marks wrapped actions so the registry test can find unguarded ones", () => {
    const { action, handler } = setup(retailer);
    const a = action({ role: "DESK", input: z.object({ orderId: z.string() }), handler });
    expect(a[ACTION_MARK]).toBe("DESK");
    expect(isGuardedAction(a)).toBe(true);
    expect(isGuardedAction(async () => {})).toBe(false);
  });
});
