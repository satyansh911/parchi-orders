// Turns a (schema-validated but untrusted) model interpretation into capture
// lines the retailer reviews (D94, D97, D3, D8, D10). Pure and deterministic:
// every decision that matters is made here, not by the model.

import { mentionsLargest, mentionsSmallest, normaliseText, numbersIn, productWords, supportCount, unitIn, type UnitWord } from "./text";

export const MAX_CAPTURE_LINES = 30;
export const HIGH_THRESHOLD = 90;
export const MEDIUM_THRESHOLD = 70;

export type CaptureSku = {
  id: string;
  shortId: string;
  code: string;
  nameEn: string;
  nameHi: string;
  brand: string;
  categoryEn: string;
  categoryHi: string;
  packSize: string;
  piecesPerCase: number;
  availableCases: number;
};

export type CaptureContext = {
  /** Active SKUs only. */
  skus: readonly CaptureSku[];
  /** SKU ids this retailer has ordered before (D10). */
  pastSkuIds: ReadonlySet<string>;
  /** This retailer's APPROVED aliases (D28): normalised phrase → SKU id. */
  aliases: ReadonlyMap<string, string>;
};

export type ModelLine = { raw: string; sku: string | null; qty: number | null; unit: "CASE" | "PIECE" | "UNKNOWN"; score: number; alternatives: string[]; note?: string };
export type ModelOutput = { lines: ModelLine[]; unmatched: string[] };

export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "NEEDS_CLARIFICATION";
export type CaptureFlag =
  | "UNMATCHED" | "NOT_IN_MESSAGE" | "UNIT_UNCLEAR" | "PIECES" | "QTY_UNCLEAR" | "PACK_SIZE_UNCLEAR"
  | "PRODUCT_UNCLEAR" | "WEAK_MATCH" | "OUT_OF_STOCK" | "DUPLICATE" | "ALIAS" | "PAST_ORDER";

export type CaptureLineDraft = {
  position: number;
  raw: string;
  aiSkuId: string | null;
  aiQty: number | null;
  aiUnit: string | null;
  aiScore: number | null;
  finalScore: number | null;
  confidence: Confidence;
  /** The product shown as the suggestion (null = the retailer must choose). */
  suggestedSkuId: string | null;
  /** Quantity in cases, only when the words state cases explicitly. */
  suggestedCases: number | null;
  alternativeSkuIds: string[];
  flags: CaptureFlag[];
  note: string | null;
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const haystackOf = (s: CaptureSku) => [s.nameEn, s.nameHi, s.brand, s.categoryEn, s.categoryHi].join(" ");
const baseName = (s: CaptureSku) => normaliseText(s.nameEn.replace(s.packSize, "")).replace(/[ ,]+$/, "");

/** Pack size in comparable base units (g, ml, bags…). */
function packMagnitude(packSize: string): { value: number; unit: string } {
  const m = /([\d.]+)\s*([a-zA-Z]+)/.exec(packSize);
  if (!m) return { value: Number.NaN, unit: packSize };
  const value = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === "kg") return { value: value * 1000, unit: "g" };
  if (unit === "l") return { value: value * 1000, unit: "ml" };
  return { value, unit };
}

export function postprocessCapture(message: string, model: ModelOutput, ctx: CaptureContext): CaptureLineDraft[] {
  const byShort = new Map(ctx.skus.map((s) => [s.shortId, s]));
  const byId = new Map(ctx.skus.map((s) => [s.id, s]));
  const msg = normaliseText(message);
  const drafts: CaptureLineDraft[] = [];

  for (const line of model.lines) {
    if (drafts.length >= MAX_CAPTURE_LINES) break;
    drafts.push(oneLine(drafts.length, line, msg, ctx, byShort, byId));
  }
  for (const raw of model.unmatched) {
    if (drafts.length >= MAX_CAPTURE_LINES) break;
    drafts.push(oneLine(drafts.length, { raw, sku: null, qty: null, unit: "UNKNOWN", score: 0, alternatives: [] }, msg, ctx, byShort, byId));
  }

  // The same product on two lines: flag both; the retailer sees it before adding (D48).
  const counts = new Map<string, number>();
  for (const d of drafts) if (d.suggestedSkuId) counts.set(d.suggestedSkuId, (counts.get(d.suggestedSkuId) ?? 0) + 1);
  for (const d of drafts) if (d.suggestedSkuId && (counts.get(d.suggestedSkuId) ?? 0) > 1) d.flags.push("DUPLICATE");
  return drafts;
}

function oneLine(
  position: number,
  line: ModelLine,
  msg: string,
  ctx: CaptureContext,
  byShort: Map<string, CaptureSku>,
  byId: Map<string, CaptureSku>,
): CaptureLineDraft {
  const raw = String(line.raw ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 120);
  const flags: CaptureFlag[] = [];
  const inMessage = raw.length > 0 && msg.includes(normaliseText(raw));
  if (!inMessage) flags.push("NOT_IN_MESSAGE");

  const words = productWords(raw);
  const unit: UnitWord = unitIn(raw);
  const numbers = numbersIn(raw);

  // Alias (approved only, D28): exact product phrase → one active SKU.
  const aliasSku = ctx.aliases.has(words.join(" ")) ? byId.get(ctx.aliases.get(words.join(" "))!) : undefined;
  const modelSku = line.sku ? byShort.get(line.sku) : undefined;
  const suggested = aliasSku ?? modelSku ?? null;
  if (aliasSku) flags.push("ALIAS");

  // Quantity: must be a whole number of 1–999 that actually appears in the words.
  const qty = Number.isInteger(line.qty) && line.qty! >= 1 && line.qty! <= 999 ? line.qty! : null;
  const qtyInWords = qty !== null && numbers.some((n) => n.value === qty && !n.packUnitAfter);
  if (!qtyInWords) flags.push("QTY_UNCLEAR");
  if (unit === "PIECE") flags.push("PIECES");
  else if (unit === "UNKNOWN") flags.push("UNIT_UNCLEAR");

  const alternatives = pickAlternatives(line.alternatives, suggested, words, ctx, byShort);

  if (!suggested) {
    flags.push("UNMATCHED");
    return { ...draft(position, raw, line, null, null, "LOW", null, alternatives, flags), aiSkuId: modelSku?.id ?? null };
  }

  const support = supportCount(haystackOf(suggested), words);
  const past = ctx.pastSkuIds.has(suggested.id);
  if (past) flags.push("PAST_ORDER");
  if (suggested.availableCases === 0) flags.push("OUT_OF_STOCK");

  // Pack size (D97): same-product sizes exist → the words must pin this one.
  const siblings = ctx.skus.filter((s) => s.id !== suggested.id && baseName(s) === baseName(suggested));
  let packPinned = siblings.length === 0 || Boolean(aliasSku);
  if (!packPinned) {
    const mine = packMagnitude(suggested.packSize);
    const group = [suggested, ...siblings].map((s) => packMagnitude(s.packSize).value);
    const packNumber = Number.parseFloat(suggested.packSize);
    const numberPinned = numbers.some((n) => n.value === packNumber && (n.packUnitAfter || n.value !== qty));
    const smallest = mentionsSmallest(raw) && mine.value === Math.min(...group);
    const largest = mentionsLargest(raw) && mine.value === Math.max(...group);
    packPinned = numberPinned || smallest || largest;
  }
  if (!packPinned) flags.push("PACK_SIZE_UNCLEAR");

  // Product identity (D97): another product equally supported by the words.
  const competitors = support > 0 ? ctx.skus.filter((s) => baseName(s) !== baseName(suggested) && supportCount(haystackOf(s), words) >= support) : [];
  const identityResolvedByHistory = past && !competitors.some((c) => ctx.pastSkuIds.has(c.id));
  const identityAmbiguous = competitors.length > 0 && !identityResolvedByHistory && !aliasSku;
  if (identityAmbiguous) flags.push("PRODUCT_UNCLEAR");
  if (support === 0 && !aliasSku) flags.push("WEAK_MATCH");

  // Score: the model's number is one signal (D10, D97).
  let score = clamp(Number.isFinite(line.score) ? Math.round(line.score) : 0, 0, 100);
  if (aliasSku) score = 100;
  else {
    score += past ? 10 : -15;
    if (support === 0) score -= 20;
  }
  score = clamp(score, 0, 100);

  const caseQty = unit === "CASE" && qtyInWords ? qty : null;
  let confidence: Confidence;
  if (unit !== "CASE" || !qtyInWords || !packPinned) confidence = "NEEDS_CLARIFICATION";
  else if (aliasSku) confidence = "HIGH";
  else {
    confidence = score >= HIGH_THRESHOLD ? "HIGH" : score >= MEDIUM_THRESHOLD ? "MEDIUM" : "LOW";
    if (identityAmbiguous && confidence === "HIGH") confidence = "MEDIUM";
    if ((support === 0 || !inMessage) && confidence !== "LOW") confidence = "LOW";
  }
  return { ...draft(position, raw, line, suggested, caseQty, confidence, score, alternatives, flags), aiSkuId: modelSku?.id ?? null };
}

function draft(
  position: number, raw: string, line: ModelLine, suggested: CaptureSku | null, cases: number | null,
  confidence: Confidence, finalScore: number | null, alternatives: string[], flags: CaptureFlag[],
): CaptureLineDraft {
  return {
    position,
    raw,
    aiSkuId: null, // set by oneLine: the model's own pick, kept separate from the suggestion
    aiQty: Number.isInteger(line.qty) ? line.qty : null,
    aiUnit: line.unit ?? null,
    aiScore: Number.isFinite(line.score) ? clamp(Math.round(line.score), 0, 100) : null,
    finalScore,
    confidence,
    suggestedSkuId: suggested?.id ?? null,
    suggestedCases: cases,
    alternativeSkuIds: alternatives,
    flags,
    note: typeof line.note === "string" && line.note.trim() ? line.note.trim().slice(0, 200) : null,
  };
}

/** Up to two distinct active alternatives: the model's valid ones, then pack variants, then the best word matches. */
function pickAlternatives(modelAlts: readonly string[], suggested: CaptureSku | null, words: string[], ctx: CaptureContext, byShort: Map<string, CaptureSku>): string[] {
  const chosen: string[] = [];
  const add = (s: CaptureSku | undefined) => {
    if (s && s.id !== suggested?.id && !chosen.includes(s.id) && chosen.length < 2) chosen.push(s.id);
  };
  for (const alt of modelAlts ?? []) add(byShort.get(alt));
  if (suggested) for (const s of ctx.skus) if (baseName(s) === baseName(suggested)) add(s);
  const ranked = ctx.skus
    .map((s) => ({ s, n: supportCount(haystackOf(s), words) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.s.code.localeCompare(b.s.code));
  for (const { s } of ranked) add(s);
  return chosen;
}

