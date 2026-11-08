// The retailer's catalogue (D5, D25, D26, D74, D80). Prices are the viewer's
// own tier prices from the domain engine; stock is only a band; nothing
// here is cached (D87, D69.10).

import type { PrismaClient } from "@/generated/prisma/client";
import { stockBand, type StockBand } from "@/domain/catalogue/stock-band";
import { casePricePaise, piecePriceForDisplay } from "@/domain/pricing/case-price";
import { isSchemeActive } from "@/domain/schemes/validity";
import { availableCases } from "@/domain/stock/line-stock";
import type { Viewer } from "../auth/session-store";
import { getPricingTier } from "../data/retailers";

export type CatalogueOffer = { id: string; type: "FREE_GOODS" | "SLAB_DISCOUNT"; labelEn: string; labelHi: string };

export type CatalogueItem = {
  id: string;
  code: string;
  nameEn: string;
  nameHi: string;
  brand: string;
  categorySlug: string;
  categoryEn: string;
  categoryHi: string;
  packSize: string;
  piecesPerCase: number;
  imageKey: string;
  /** Consumer MRP per piece, GST-inclusive (A.2). Never the dealer price. */
  mrpPaise: number | null;
  /** This retailer's price per case, GST extra (A.2, D5). */
  casePricePaise: number;
  /** Display only. */
  piecePricePaise: number;
  gstBps: number;
  stock: StockBand;
  offers: CatalogueOffer[];
};

export type CatalogueCategory = { slug: string; nameEn: string; nameHi: string };

type SkuRow = Awaited<ReturnType<typeof loadSkus>>[number];

function loadSkus(db: PrismaClient) {
  return db.sku.findMany({
    where: { active: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { nameEn: "asc" }],
    include: { brand: true, category: true, schemes: true },
  });
}

/** Pure mapping, unit-tested: only safe fields leave the server. */
export function toCatalogueItem(row: SkuRow, tierDiscountBps: number, now: Date): CatalogueItem {
  const casePrice = casePricePaise(row, tierDiscountBps);
  return {
    id: row.id,
    code: row.code,
    nameEn: row.nameEn,
    nameHi: row.nameHi,
    brand: row.brand.name,
    categorySlug: row.category.slug,
    categoryEn: row.category.nameEn,
    categoryHi: row.category.nameHi,
    packSize: row.packSize,
    piecesPerCase: row.piecesPerCase,
    imageKey: row.imageKey,
    mrpPaise: row.mrpPaise,
    casePricePaise: casePrice,
    piecePricePaise: piecePriceForDisplay(casePrice, row.piecesPerCase),
    gstBps: row.gstBps,
    stock: stockBand(availableCases(row.stockCases, row.reservedCases)),
    offers: row.schemes
      .filter((s) => isSchemeActive(s, now))
      .map((s) => ({ id: s.id, type: s.type, labelEn: s.labelEn, labelHi: s.labelHi })),
  };
}

export async function getCatalogue(db: PrismaClient, viewer: Viewer, now: Date) {
  const tier = await getPricingTier(db, viewer); // the viewer's own tier only
  const rows = await loadSkus(db);
  const items = rows.map((row) => toCatalogueItem(row, tier.discountBps, now));
  const categories: CatalogueCategory[] = [];
  for (const row of rows) {
    if (!categories.some((c) => c.slug === row.category.slug)) {
      categories.push({ slug: row.category.slug, nameEn: row.category.nameEn, nameHi: row.category.nameHi });
    }
  }
  return { tier, categories, items };
}
