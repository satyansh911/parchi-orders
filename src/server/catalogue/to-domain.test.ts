import { describe, expect, it } from "vitest";
import type { Scheme as SchemeRow, Sku as SkuRow } from "@/generated/prisma/client";
import { DomainError } from "@/domain/errors";
import { toCatalogueSku, toDomainScheme } from "./to-domain";

const schemeRow = (fields: Partial<SchemeRow>): SchemeRow => ({
  id: "s1",
  skuId: "sku1",
  type: "FREE_GOODS",
  labelEn: "Buy 10 cases get 1 free",
  labelHi: "10 पेटी पर 1 पेटी मुफ़्त",
  buyCases: 10,
  freeCases: 1,
  minCases: null,
  discountBps: null,
  startsAt: null,
  endsAt: null,
  active: true,
  ...fields,
});

const skuRow: SkuRow = {
  id: "sku1",
  code: "SKU-BS-075",
  nameEn: "Glucose biscuit 75 g",
  nameHi: "ग्लूकोज़ बिस्कुट 75 ग्राम",
  brandId: "b1",
  categoryId: "c1",
  packSize: "75 g",
  piecesPerCase: 96,
  dealerPricePaise: 810,
  dealerPriceUnit: "PIECE",
  mrpPaise: 1000,
  gstBps: 500,
  stockCases: 340,
  reservedCases: 0,
  imageKey: "box",
  active: true,
};

describe("toDomainScheme", () => {
  it("maps a free-goods row", () => {
    expect(toDomainScheme(schemeRow({}))).toEqual({
      id: "s1", type: "FREE_GOODS", buyCases: 10, freeCases: 1,
      labelEn: "Buy 10 cases get 1 free", labelHi: "10 पेटी पर 1 पेटी मुफ़्त",
      active: true, startsAt: null, endsAt: null,
    });
  });

  it("maps a slab row, keeping its dates", () => {
    const endsAt = new Date("2026-10-31T18:30:00Z");
    const s = toDomainScheme(schemeRow({ type: "SLAB_DISCOUNT", buyCases: null, freeCases: null, minCases: 5, discountBps: 300, endsAt }));
    expect(s).toMatchObject({ type: "SLAB_DISCOUNT", minCases: 5, discountBps: 300, endsAt });
  });

  it("refuses rows missing the columns their type needs", () => {
    expect(() => toDomainScheme(schemeRow({ buyCases: null }))).toThrow(DomainError);
    expect(() => toDomainScheme(schemeRow({ type: "SLAB_DISCOUNT", minCases: null, discountBps: 300 }))).toThrow(DomainError);
  });
});

describe("toCatalogueSku", () => {
  it("keeps exactly the fields the engine prices with", () => {
    expect(toCatalogueSku({ ...skuRow, schemes: [schemeRow({})] })).toEqual({
      id: "sku1", code: "SKU-BS-075", nameEn: "Glucose biscuit 75 g", nameHi: "ग्लूकोज़ बिस्कुट 75 ग्राम",
      active: true, dealerPricePaise: 810, dealerPriceUnit: "PIECE", piecesPerCase: 96, gstBps: 500,
      schemes: [expect.objectContaining({ id: "s1", type: "FREE_GOODS" })],
    });
  });
});
