// Prices a cart for one retailer (D74). Used by the preview action and, inside
// the placement transaction, by placement itself (D75), so both always agree.
// Everything comes from the domain engine: no pricing logic lives here.

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { decideCredit, type CreditPosition } from "@/domain/credit/credit";
import { MAX_ORDER_TOTAL_PAISE } from "@/domain/pricing/limits";
import { nudgeFor, type Nudge } from "@/domain/pricing/nudge";
import type { PricedLine, PricingContext } from "@/domain/pricing/price-line";
import type { Offer } from "@/domain/schemes/best-offer";
import { availableCases, evaluateLineStock, type OfferChoice, type OfferSelection, type StockOption } from "@/domain/stock/line-stock";
import { toCatalogueSku } from "../catalogue/to-domain";
import { creditPositionFor } from "../data/credit";
import { quoteDigest, signQuote, type QuoteFacts } from "./quote";

type Db = PrismaClient | Prisma.TransactionClient;

export type CartLineInput = { skuId: string; paidCases: number; choice?: OfferChoice };

export type OfferView = Pick<Offer, "id" | "type" | "labelEn" | "labelHi" | "discountBps" | "freeCases">;
export type LineView = Omit<PricedLine, "skuId" | "applied" | "otherOffer"> & { applied: OfferView | null; otherOffer: OfferView | null };
export type OptionView = { kind: StockOption["kind"]; choice: OfferChoice; paidCases: number; freeCases: number; discountBps: number; lineTotalPaise: number };
export type SkuView = { code: string; nameEn: string; nameHi: string; packSize: string; piecesPerCase: number; imageKey: string; brand: string };

type Base = { skuId: string; requestedCases: number; choice: OfferChoice };
export type CartLineResult =
  | (Base & { status: "UNKNOWN" })
  | (Base & { status: "INACTIVE" | "OUT_OF_STOCK"; sku: SkuView })
  | (Base & { status: "OK"; sku: SkuView; selection: OfferSelection; line: LineView; nudge: Nudge | null })
  | (Base & { status: "STOCK_SHORT"; sku: SkuView; reason: "MORE_THAN_AVAILABLE" | "FREE_GOODS_DONT_FIT"; options: OptionView[] })
  | (Base & { status: "OFFER_CHANGED"; sku: SkuView; current: LineView | null });

export type CartProblem = "EMPTY" | "LINES_NEED_ATTENTION" | "ORDER_TOO_LARGE";

export type CartPreview = {
  lines: CartLineResult[];
  totals: { taxablePaise: number; discountPaise: number; gstPaise: number; totalPaise: number; gstByRate: { gstBps: number; gstPaise: number }[] };
  credit: CreditPosition & { hold: boolean; overByPaise: number };
  problem: CartProblem | null;
  /** Signed quote (D75), only when the cart can be placed as shown. */
  quote: string | null;
};

export type PricedCart = { preview: CartPreview; digest: string | null; okLines: Array<{ input: CartLineInput; selection: OfferSelection; line: PricedLine }> };

export async function priceCart(
  deps: { db: Db; key: Buffer; now: Date },
  retailer: { id: string; tierDiscountBps: number },
  inputs: readonly CartLineInput[],
): Promise<PricedCart> {
  const ctx: PricingContext = { tierDiscountBps: retailer.tierDiscountBps, now: deps.now };
  const rows = await deps.db.sku.findMany({
    where: { id: { in: inputs.map((l) => l.skuId) } },
    include: { schemes: true, brand: { select: { name: true } } },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  const lines: CartLineResult[] = [];
  const okLines: PricedCart["okLines"] = [];

  for (const input of inputs) {
    const choice = input.choice ?? "BEST";
    const base: Base = { skuId: input.skuId, requestedCases: input.paidCases, choice };
    const row = byId.get(input.skuId);
    if (!row) {
      lines.push({ ...base, status: "UNKNOWN" });
      continue;
    }
    const sku: SkuView = { code: row.code, nameEn: row.nameEn, nameHi: row.nameHi, packSize: row.packSize, piecesPerCase: row.piecesPerCase, imageKey: row.imageKey, brand: row.brand.name };
    if (!row.active) {
      lines.push({ ...base, status: "INACTIVE", sku });
      continue;
    }

    const catalogueSku = toCatalogueSku(row);
    const available = availableCases(row.stockCases, row.reservedCases);
    const result = evaluateLineStock({ sku: catalogueSku, requestedCases: input.paidCases, availableCases: available, choice }, ctx);

    if (result.status === "OK") {
      const nudge = result.selection === "BEST_OFFER" ? nudgeFor({ sku: catalogueSku, paidCases: result.line.paidCases, availableCases: available }, ctx) : null;
      lines.push({ ...base, status: "OK", sku, selection: result.selection, line: lineView(result.line), nudge });
      okLines.push({ input: { ...input, choice }, selection: result.selection, line: result.line });
    } else if (result.status === "OUT_OF_STOCK") {
      lines.push({ ...base, status: "OUT_OF_STOCK", sku });
    } else if (result.status === "STOCK_SHORT") {
      lines.push({ ...base, status: "STOCK_SHORT", sku, reason: result.reason, options: result.options.map(optionView) });
    } else {
      // OFFER_CHANGED (D47): show the current best line; nothing switches silently.
      const current = result.current.status === "OK" ? lineView(result.current.line) : null;
      lines.push({ ...base, status: "OFFER_CHANGED", sku, current });
    }
  }

  const totals = sumTotals(okLines.map((l) => l.line));
  const position = await creditPositionFor(deps.db, retailer.id);
  const decision = decideCredit(position, totals.totalPaise);
  const credit = { ...position, ...decision };

  const problem: CartProblem | null =
    inputs.length === 0 ? "EMPTY" : okLines.length !== inputs.length ? "LINES_NEED_ATTENTION" : totals.totalPaise > MAX_ORDER_TOTAL_PAISE ? "ORDER_TOO_LARGE" : null;

  let quote: string | null = null;
  let digest: string | null = null;
  if (problem === null) {
    const facts = quoteFacts(retailer.id, okLines, totals, decision);
    digest = quoteDigest(facts);
    quote = signQuote(facts, deps.key, deps.now);
  }
  return { preview: { lines, totals, credit, problem, quote }, digest, okLines };
}

function quoteFacts(retailerId: string, okLines: PricedCart["okLines"], totals: CartPreview["totals"], credit: { hold: boolean; overByPaise: number }): QuoteFacts {
  return {
    retailerId,
    lines: okLines.map(({ input, line }) => ({
      skuId: line.skuId,
      paidCases: line.paidCases,
      choice: input.choice ?? "BEST",
      freeCases: line.freeCases,
      casePricePaise: line.casePricePaise,
      appliedSchemeId: line.applied?.id ?? null,
      discountPaise: line.discountPaise,
      gstBps: line.gstBps,
      gstPaise: line.gstPaise,
      lineTotalPaise: line.lineTotalPaise,
    })),
    totals: { taxablePaise: totals.taxablePaise, discountPaise: totals.discountPaise, gstPaise: totals.gstPaise, totalPaise: totals.totalPaise },
    credit: { hold: credit.hold, overByPaise: credit.overByPaise },
  };
}

function sumTotals(lines: PricedLine[]): CartPreview["totals"] {
  const sum = (pick: (l: PricedLine) => number) => lines.reduce((t, l) => t + pick(l), 0);
  const byRate = new Map<number, number>();
  for (const l of lines) byRate.set(l.gstBps, (byRate.get(l.gstBps) ?? 0) + l.gstPaise);
  return {
    taxablePaise: sum((l) => l.taxablePaise),
    discountPaise: sum((l) => l.discountPaise),
    gstPaise: sum((l) => l.gstPaise),
    totalPaise: sum((l) => l.lineTotalPaise),
    gstByRate: [...byRate].sort(([a], [b]) => a - b).map(([gstBps, gstPaise]) => ({ gstBps, gstPaise })),
  };
}

const offerView = (o: Offer | null): OfferView | null =>
  o && { id: o.id, type: o.type, labelEn: o.labelEn, labelHi: o.labelHi, discountBps: o.discountBps, freeCases: o.freeCases };

function lineView(line: PricedLine): LineView {
  const { skuId: _skuId, applied, otherOffer, ...rest } = line;
  return { ...rest, applied: offerView(applied), otherOffer: offerView(otherOffer) };
}

function optionView(option: StockOption): OptionView {
  return { kind: option.kind, choice: option.choice, paidCases: option.line.paidCases, freeCases: option.line.freeCases, discountBps: option.line.discountBps, lineTotalPaise: option.line.lineTotalPaise };
}
