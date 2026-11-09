// AI capture on real Postgres with the fake provider (test branch only, D49, D100).
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeRetailer } from "../testing/fixtures";
import { createTestClient, resetTestDatabase, resolveTestDatabaseUrl } from "../testing/test-database";
import { confirmCapture } from "./confirm";
import { fakeProvider } from "./fake-provider";
import { interpretMessage } from "./interpret";
import type { CaptureProvider } from "./provider";

const db = createTestClient(resolveTestDatabaseUrl());
afterAll(() => db.$disconnect());
const NOW = new Date("2026-11-09T09:00:00Z");
const BRIEF = "bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti";

type R = Awaited<ReturnType<typeof makeRetailer>>;
let A: R;
let B: R;
const ids: Record<string, string> = {};

beforeEach(async () => {
  await resetTestDatabase(db);
  const brand = await db.brand.create({ data: { name: "Rewa Foods" } });
  const category = await db.category.create({ data: { slug: "c", nameEn: "Biscuits", nameHi: "बिस्कुट", sortOrder: 1 } });
  const mk = (code: string, nameEn: string, packSize: string, stockCases: number, active = true) =>
    db.sku.create({ data: { code, nameEn, nameHi: nameEn, brandId: brand.id, categoryId: category.id, packSize, piecesPerCase: 10, dealerPricePaise: 100, gstBps: 500, stockCases, imageKey: "box", active } });
  for (const [code, name, pack, stock] of [
    ["SKU-BS-075", "Glucose biscuit 75 g", "75 g", 340], ["SKU-BS-150", "Glucose biscuit 150 g", "150 g", 200], ["SKU-CR-100", "Cream biscuit 100 g", "100 g", 50],
    ["SKU-DT-1KG", "Detergent powder 1 kg", "1 kg", 85], ["SKU-DT-500", "Detergent powder 500 g", "500 g", 100], ["SKU-DT-2KG", "Detergent powder 2 kg", "2 kg", 50],
    ["SKU-TE-250", "Tea leaf 250 g", "250 g", 0], ["SKU-TD-250", "Tea dust 250 g", "250 g", 90], ["SKU-TE-500", "Tea leaf 500 g", "500 g", 75],
  ] as const) ids[code] = (await mk(code, name, pack, stock)).id;
  ids.OLD = (await mk("SKU-OLD", "Old biscuit", "50 g", 10, false)).id;
  A = await makeRetailer(db, "R-A", "9999900101");
  B = await makeRetailer(db, "R-B", "9999900102");
});

const who = (r: R) => ({ userId: r.user.id, retailerId: r.retailer.id });
const interpret = (r: R, message: string, clientRequestId = randomUUID(), provider: CaptureProvider = fakeProvider) =>
  interpretMessage({ db, provider, now: NOW }, who(r), { clientRequestId, message });
const nothingOrderedOrReserved = async () => {
  expect(await db.order.count()).toBe(0);
  expect((await db.sku.aggregate({ _sum: { reservedCases: true } }))._sum.reservedCases).toBe(0);
};

describe("interpretMessage", () => {
  it("stores the original message, the raw model output and reviewed lines, and creates no order or reservation", async () => {
    const r = await interpret(A, BRIEF);
    expect(r).toMatchObject({ outcome: "OK", reused: false });
    const capture = await db.capture.findUniqueOrThrow({ where: { id: (r as { captureId: string }).captureId }, include: { lines: { orderBy: { position: "asc" } } } });
    expect(capture).toMatchObject({ rawText: BRIEF, status: "PARSED", retailerId: A.retailer.id, model: "fake" });
    expect(capture.aiResponse).toBeTruthy();
    expect(capture.lines.map((l) => [l.suggestedSkuId, l.suggestedCases])).toEqual([[ids["SKU-BS-075"], 5], [ids["SKU-DT-1KG"], 2], [ids["SKU-TE-250"], 1]]);
    expect(capture.lines[2].flags).toContain("OUT_OF_STOCK");
    await nothingOrderedOrReserved();
  });

  it("a retry with the same request ID returns the same capture (D96); a new ID is a new capture", async () => {
    const id = randomUUID();
    const first = await interpret(A, BRIEF, id);
    const retry = await interpret(A, BRIEF, id);
    expect(retry).toEqual({ ...first, reused: true });
    await interpret(A, BRIEF); // same text, new ID: an intentional second capture
    expect(await db.capture.count()).toBe(2);
  });

  it("refuses another retailer's request ID", async () => {
    const id = randomUUID();
    await interpret(A, BRIEF, id);
    expect(await interpret(B, BRIEF, id)).toEqual({ outcome: "REJECTED" });
  });

  it.each([["#timeout", "TIMEOUT"], ["#busy", "UPSTREAM_BUSY"], ["#error", "API_ERROR"], ["#garbage", "INVALID_JSON"], ["#empty", "EMPTY"]])(
    "provider failure %s becomes a FAILED capture (%s) with the message kept, never a crash",
    async (message, reason) => {
      const r = await interpret(A, `5 peti biscuit ${message}`);
      expect(r).toMatchObject({ outcome: "FAILED" });
      const c = await db.capture.findUniqueOrThrow({ where: { id: (r as { captureId: string }).captureId } });
      expect(c).toMatchObject({ status: "FAILED", failReason: reason, rawText: `5 peti biscuit ${message}` });
    },
  );

  it("rate-limits to 5 per minute per user (D14)", async () => {
    const results = [];
    for (let i = 0; i < 6; i++) results.push((await interpret(A, `#empty ${i}`)).outcome);
    expect(results).toEqual(["FAILED", "FAILED", "FAILED", "FAILED", "FAILED", "RATE_LIMITED"]);
  });
});

describe("confirmCapture (D92, D98)", () => {
  async function brief(r: R) {
    const res = await interpret(r, BRIEF);
    return db.capture.findUniqueOrThrow({ where: { id: (res as { captureId: string }).captureId }, include: { lines: { orderBy: { position: "asc" } } } });
  }

  it("stores resolutions separately from the original words and the model's pick, and returns cart lines", async () => {
    const c = await brief(A);
    const [biscuit, detergent, tea] = c.lines;
    const result = await confirmCapture(db, who(A), c.id, [
      { lineId: biscuit.id, skuId: ids["SKU-BS-075"], cases: 5 }, // accepted as suggested
      { lineId: detergent.id, skuId: ids["SKU-DT-500"], cases: 3 }, // corrected
      { lineId: tea.id, removed: true },
      { skuId: ids["SKU-CR-100"], cases: 1 }, // added by hand
    ], NOW);
    expect(result).toEqual({ alreadyConfirmed: false, lines: [{ skuId: ids["SKU-BS-075"], paidCases: 5 }, { skuId: ids["SKU-DT-500"], paidCases: 3 }, { skuId: ids["SKU-CR-100"], paidCases: 1 }] });
    const after = await db.capture.findUniqueOrThrow({ where: { id: c.id }, include: { lines: { orderBy: { position: "asc" } } } });
    expect(after).toMatchObject({ status: "CONFIRMED", rawText: BRIEF });
    expect(after.lines.map((l) => l.resolution)).toEqual(["ACCEPTED", "CORRECTED", "REMOVED", "ACCEPTED"]);
    expect(after.lines[1]).toMatchObject({ aiSkuId: ids["SKU-DT-1KG"], suggestedSkuId: ids["SKU-DT-1KG"], resolvedSkuId: ids["SKU-DT-500"], raw: "2 peti washing powder 1 kilo" });
    expect(after.lines[3].flags).toEqual(["MANUAL"]);
    await nothingOrderedOrReserved();
  });

  it("is idempotent: retries (and double taps) return the stored result and ignore new input", async () => {
    const c = await brief(A);
    const input = c.lines.map((l) => ({ lineId: l.id, skuId: l.suggestedSkuId!, cases: 2 }));
    const [one, two] = await Promise.all([confirmCapture(db, who(A), c.id, input, NOW), confirmCapture(db, who(A), c.id, input, NOW)]);
    expect([one.alreadyConfirmed, two.alreadyConfirmed].sort()).toEqual([false, true]);
    expect(one.lines).toEqual(two.lines);
    const later = await confirmCapture(db, who(A), c.id, [{ skuId: ids["SKU-CR-100"], cases: 99 }], NOW);
    expect(later).toEqual({ alreadyConfirmed: true, lines: one.lines });
  });

  it("requires every line to be resolved or removed, and refuses inactive SKUs", async () => {
    const c = await brief(A);
    await expect(confirmCapture(db, who(A), c.id, [{ lineId: c.lines[0].id, skuId: ids["SKU-BS-075"], cases: 5 }], NOW)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    const all = c.lines.map((l) => ({ lineId: l.id, skuId: ids.OLD, cases: 1 }));
    await expect(confirmCapture(db, who(A), c.id, all, NOW)).rejects.toMatchObject({ code: "NOT_ALLOWED" });
    expect((await db.capture.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("PARSED");
  });

  it("refuses another retailer's capture with NOT_FOUND", async () => {
    const c = await brief(A);
    await expect(confirmCapture(db, who(B), c.id, c.lines.map((l) => ({ lineId: l.id, removed: true as const })), NOW)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("sums the same product from two lines into one cart line (D48)", async () => {
    const c = await brief(A);
    const result = await confirmCapture(db, who(A), c.id, c.lines.map((l) => ({ lineId: l.id, skuId: ids["SKU-BS-075"], cases: 2 })), NOW);
    expect(result.lines).toEqual([{ skuId: ids["SKU-BS-075"], paidCases: 6 }]);
  });
});

describe("capture → order link", () => {
  it("links a confirmed capture to the order placed from it, once, and only for its own retailer", async () => {
    const { randomBytes } = await import("node:crypto");
    const { priceCart } = await import("../cart/price-cart");
    const { placeOrder } = await import("../orders/place-order");
    const key = randomBytes(32);
    const res = await interpret(A, BRIEF);
    const c = await db.capture.findUniqueOrThrow({ where: { id: (res as { captureId: string }).captureId }, include: { lines: true } });
    const confirmed = await confirmCapture(db, who(A), c.id, c.lines.map((l) => ({ lineId: l.id, skuId: ids["SKU-BS-075"], cases: 1 })), NOW);
    const placeAs = async (r: R, captureId: string) => {
      const { preview } = await priceCart({ db, key, now: NOW }, { id: r.retailer.id, tierDiscountBps: 0 }, confirmed.lines);
      return placeOrder({ db, key, now: NOW }, who(r), { clientRequestId: randomUUID(), lines: confirmed.lines, quote: preview.quote!, confirmCreditHold: preview.credit.hold, captureId });
    };
    const foreign = await placeAs(B, c.id); // B can't claim A's capture: placed, but unlinked
    const mine = await placeAs(A, c.id);
    const again = await placeAs(A, c.id); // already linked: second order is plain
    const orders = await db.order.findMany({ orderBy: { number: "asc" }, select: { captureId: true, source: true, retailerId: true } });
    expect([foreign.outcome, mine.outcome, again.outcome]).toEqual(["PLACED", "PLACED", "PLACED"]);
    expect(orders.map((o) => [o.source, o.captureId])).toEqual([["CATALOGUE", null], ["AI_CAPTURE", c.id], ["CATALOGUE", null]]);
  });
});

describe("desk-verified aliases (D28)", () => {
  it("the desk saves a corrected line's words as the retailer's alias; the next capture uses it, for that retailer only", async () => {
    const { saveAliasFromCaptureLine } = await import("../desk/aliases");
    const desk = await db.user.create({ data: { phone: "9999900001", name: "Desk", role: "DESK" } });
    const first = await interpret(A, BRIEF);
    const c = await db.capture.findUniqueOrThrow({ where: { id: (first as { captureId: string }).captureId }, include: { lines: { orderBy: { position: "asc" } } } });
    const [biscuit, detergent, tea] = c.lines;
    await confirmCapture(db, who(A), c.id, [
      { lineId: biscuit.id, skuId: ids["SKU-BS-075"], cases: 5 },
      { lineId: detergent.id, skuId: ids["SKU-DT-500"], cases: 2 }, // the retailer meant 500 g
      { lineId: tea.id, removed: true },
    ], NOW);

    await expect(saveAliasFromCaptureLine(db, { userId: desk.id }, tea.id)).rejects.toMatchObject({ code: "NOT_ALLOWED" }); // removed line
    expect(await saveAliasFromCaptureLine(db, { userId: desk.id }, detergent.id)).toEqual({ outcome: "SAVED", phrase: "washing powder 1 kilo" });
    expect(await saveAliasFromCaptureLine(db, { userId: desk.id }, detergent.id)).toMatchObject({ outcome: "UNCHANGED" });

    const next = async (r: R) => {
      const res = await interpret(r, BRIEF);
      return db.captureLine.findMany({ where: { captureId: (res as { captureId: string }).captureId }, orderBy: { position: "asc" } });
    };
    const again = await next(A);
    expect(again[1]).toMatchObject({ suggestedSkuId: ids["SKU-DT-500"], confidence: "HIGH" });
    expect(again[1].flags).toContain("ALIAS");
    const other = await next(B); // another retailer's words are unaffected
    expect(other[1].suggestedSkuId).toBe(ids["SKU-DT-1KG"]);
  });
});

describe("photo and voice capture (D111)", () => {
  const media = async (kind: "PHOTO" | "VOICE", magic: number[], extra = "") => {
    const { checkMedia } = await import("./media");
    const data = Buffer.concat([Buffer.from(magic), Buffer.from(`fake media ${extra}`)]).toString("base64");
    const checked = checkMedia(kind, kind === "PHOTO" ? "image/jpeg" : "audio/webm", data);
    if (!checked.ok) throw new Error(checked.problem);
    return checked.media;
  };
  const JPEG = [0xff, 0xd8, 0xff, 0xe0];
  const WEBM = [0x1a, 0x45, 0xdf, 0xa3];

  it("a photo's transcript becomes the original words, through the same checks; the image is not stored", async () => {
    const { FAKE_PHOTO_TRANSCRIPT } = await import("./fake-provider");
    const r = await interpretMessage({ db, provider: fakeProvider, now: NOW }, who(A), { clientRequestId: randomUUID(), media: await media("PHOTO", JPEG) });
    const c = await db.capture.findUniqueOrThrow({ where: { id: (r as { captureId: string }).captureId }, include: { lines: { orderBy: { position: "asc" } } } });
    expect(c).toMatchObject({ status: "PARSED", inputType: "PHOTO", rawText: FAKE_PHOTO_TRANSCRIPT });
    expect(c.lines.map((l) => l.suggestedSkuId)).toEqual([ids["SKU-BS-075"], ids["SKU-DT-1KG"], ids["SKU-TE-250"]]);
    expect(JSON.stringify(c.aiResponse)).not.toContain("fake media"); // no media bytes kept
    await nothingOrderedOrReserved();
  });

  it("a voice note works the same way", async () => {
    const r = await interpretMessage({ db, provider: fakeProvider, now: NOW }, who(A), { clientRequestId: randomUUID(), media: await media("VOICE", WEBM) });
    const c = await db.capture.findUniqueOrThrow({ where: { id: (r as { captureId: string }).captureId }, include: { lines: true } });
    expect(c).toMatchObject({ status: "PARSED", inputType: "VOICE", rawText: "2 peti washing powder" });
    expect(c.lines[0]).toMatchObject({ suggestedSkuId: ids["SKU-DT-1KG"], suggestedCases: 2 });
  });

  it("an unreadable or timed-out photo is a FAILED capture with a placeholder, never a crash", async () => {
    const r = await interpretMessage({ db, provider: fakeProvider, now: NOW }, who(A), { clientRequestId: randomUUID(), media: await media("PHOTO", JPEG, "#timeout") });
    expect(r).toMatchObject({ outcome: "FAILED" });
    const c = await db.capture.findUniqueOrThrow({ where: { id: (r as { captureId: string }).captureId } });
    expect(c).toMatchObject({ status: "FAILED", failReason: "TIMEOUT", rawText: "[photo]", inputType: "PHOTO" });
  });
});
