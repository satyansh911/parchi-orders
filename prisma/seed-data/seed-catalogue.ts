import type { PrismaClient } from "../../src/generated/prisma/client";
import { BRANDS, CATEGORIES, DEMO_GST_BPS, SCHEMES, SKUS } from "./catalogue";

export async function seedCatalogue(db: PrismaClient) {
  const brandIds = new Map<string, string>();
  for (const name of BRANDS) {
    const brand = await db.brand.create({ data: { name } });
    brandIds.set(name, brand.id);
  }

  const categoryIds = new Map<string, string>();
  for (const category of CATEGORIES) {
    const created = await db.category.create({ data: category });
    categoryIds.set(category.slug, created.id);
  }

  const skuIds = new Map<string, string>();
  for (const { brand, category, ...sku } of SKUS) {
    const created = await db.sku.create({
      data: {
        ...sku,
        dealerPriceUnit: "PIECE",
        gstBps: DEMO_GST_BPS[category],
        brandId: required(brandIds, brand),
        categoryId: required(categoryIds, category),
      },
    });
    skuIds.set(sku.code, created.id);
  }

  await db.scheme.createMany({
    data: SCHEMES.map(({ skuCode, ...scheme }) => ({ ...scheme, skuId: required(skuIds, skuCode) })),
  });

  return { brands: BRANDS.length, categories: CATEGORIES.length, skus: SKUS.length, schemes: SCHEMES.length };
}

function required(map: Map<string, string>, key: string): string {
  const value = map.get(key);
  if (!value) throw new Error(`Seed data refers to unknown key: ${key}`);
  return value;
}
