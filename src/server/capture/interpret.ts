// Interpret a retailer's free-text order (D94, D96, D97, D14). Creates a
// Capture with the original message, the raw model output and reviewed lines.
// It NEVER creates an order or reserves stock.

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { postprocessCapture, type CaptureContext, type CaptureSku } from "@/domain/capture/postprocess";
import { availableCases } from "@/domain/stock/line-stock";
import { incrementCounter } from "../rate-limit";
import { parseModelOutput } from "./model-output";
import type { CheckedMedia } from "./media";
import { buildPrompt } from "./prompt";
import type { CaptureProvider } from "./provider";

export const MAX_MESSAGE_CHARS = 1_000;
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export type InterpretResult =
  | { outcome: "OK" | "FAILED"; captureId: string; reused: boolean }
  | { outcome: "RATE_LIMITED" }
  | { outcome: "REJECTED" };

type Deps = { db: PrismaClient; provider: CaptureProvider; now: Date };
type Retailer = { userId: string; retailerId: string };

export function cleanMessage(message: string): string {
  return message.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").replace(/[ \t]+/g, " ").trim().slice(0, MAX_MESSAGE_CHARS);
}

/**
 * Typed text, or (D111) a checked photo / voice note: the model writes out
 * what it reads or hears, and that transcript becomes the "original words"
 * for exactly the same post-processing, review and confirmation as text.
 */
export async function interpretMessage(
  deps: Deps,
  who: Retailer,
  input: { clientRequestId: string; message?: string; media?: CheckedMedia },
): Promise<InterpretResult> {
  const typed = cleanMessage(input.message ?? "");
  if (!input.media && !typed) return { outcome: "REJECTED" };

  // D96: a retry of the same request returns the same capture; another retailer's ID is refused.
  const existing = await deps.db.capture.findUnique({ where: { clientRequestId: input.clientRequestId }, select: { id: true, retailerId: true, status: true } });
  if (existing) return existing.retailerId === who.retailerId ? { outcome: existing.status === "FAILED" ? "FAILED" : "OK", captureId: existing.id, reused: true } : { outcome: "REJECTED" };

  // D14: 5/min and 40/day per user, 300/day overall. Atomic counters.
  const [perMinute, perDay, global] = await Promise.all([
    incrementCounter(deps.db, `capture:user:${who.userId}:m`, MINUTE, deps.now),
    incrementCounter(deps.db, `capture:user:${who.userId}:d`, DAY, deps.now),
    incrementCounter(deps.db, "capture:global:d", DAY, deps.now),
  ]);
  if (perMinute > 5 || perDay > 40 || global > 300) return { outcome: "RATE_LIMITED" };

  const ctx = await loadContext(deps.db, who.retailerId);
  const started = Date.now();
  const media = input.media ? { kind: input.media.kind, mimeType: input.media.mimeType, data: input.media.data } : undefined;
  const result = await deps.provider.extract(buildPrompt(typed, ctx, media), { shortIdByCode: new Map(ctx.skus.map((s) => [s.code, s.shortId])), message: typed });
  const latencyMs = Date.now() - started;
  const parsed = result.ok ? parseModelOutput(result.text) : null;
  // For media the transcript IS the message; without one there is nothing a person can check.
  const message = media ? cleanMessage(parsed?.ok ? (parsed.transcript ?? "") : "") : typed;
  const failReason = !result.ok ? result.reason : parsed && !parsed.ok ? parsed.reason : !message ? "EMPTY" : null;
  const drafts = parsed?.ok && !failReason ? postprocessCapture(message, parsed.output, ctx) : [];
  let aiResponse: Prisma.InputJsonValue | undefined;
  if (result.ok) {
    try {
      aiResponse = JSON.parse(result.text) as Prisma.InputJsonValue;
    } catch {
      aiResponse = { unparseable: result.text.slice(0, 2_000) };
    }
  }

  try {
    const capture = await deps.db.capture.create({
      data: {
        retailerId: who.retailerId,
        createdById: who.userId,
        clientRequestId: input.clientRequestId,
        rawText: message || (media?.kind === "PHOTO" ? "[photo]" : "[voice note]"),
        inputType: media?.kind ?? "TEXT",
        model: result.model,
        aiResponse,
        status: failReason ? "FAILED" : "PARSED",
        failReason,
        latencyMs,
        lines: {
          create: drafts.map((d) => ({
            position: d.position, raw: d.raw, aiSkuId: d.aiSkuId, aiQty: d.aiQty, aiUnit: d.aiUnit, aiScore: d.aiScore, finalScore: d.finalScore,
            confidence: d.confidence, suggestedSkuId: d.suggestedSkuId, suggestedCases: d.suggestedCases, alternativeSkuIds: d.alternativeSkuIds, flags: d.flags, note: d.note,
          })),
        },
      },
      select: { id: true },
    });
    return { outcome: failReason ? "FAILED" : "OK", captureId: capture.id, reused: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return interpretMessage(deps, who, input); // a simultaneous retry won: return its capture
    }
    throw error;
  }
}

async function loadContext(db: PrismaClient, retailerId: string): Promise<CaptureContext> {
  const rows = await db.sku.findMany({ where: { active: true }, orderBy: { code: "asc" }, include: { brand: true, category: true } });
  const skus: CaptureSku[] = rows.map((r, i) => ({
    id: r.id, shortId: `S${i + 1}`, code: r.code, nameEn: r.nameEn, nameHi: r.nameHi, brand: r.brand.name, categoryEn: r.category.nameEn, categoryHi: r.category.nameHi,
    packSize: r.packSize, piecesPerCase: r.piecesPerCase, availableCases: availableCases(r.stockCases, r.reservedCases),
  }));
  const past = await db.orderLine.findMany({ where: { order: { retailerId } }, distinct: ["skuId"], select: { skuId: true }, take: 200 });
  const aliases = await db.alias.findMany({ where: { retailerId }, select: { phraseNormalized: true, skuId: true } });
  return { skus, pastSkuIds: new Set(past.map((p) => p.skuId)), aliases: new Map(aliases.map((a) => [a.phraseNormalized, a.skuId])) };
}
