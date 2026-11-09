import { describe, expect, it } from "vitest";
import { buildLoadingLists, type LoadingOrder } from "./loading-list";

const van1 = { code: "VAN-1", name: "Van 1" };
const van2 = { code: "VAN-2", name: "Van 2" };
const shop = (code: string, area: string) => ({ code, shopName: `Shop ${code}`, area });
const biscuit = (paid: number, free = 0) => ({ skuCode: "SKU-BS-075", nameEn: "Glucose biscuit 75 g", paidCases: paid, freeCases: free });
const detergent = (paid: number) => ({ skuCode: "SKU-DT-1KG", nameEn: "Detergent powder 1 kg", paidCases: paid, freeCases: 0 });

const orders: LoadingOrder[] = [
  { number: 12, totalPaise: 100, van: van1, retailer: shop("R-2", "Ranjhi"), lines: [biscuit(10, 1)] },
  { number: 10, totalPaise: 200, van: van1, retailer: shop("R-1", "Adhartal"), lines: [biscuit(5), detergent(2)] },
  { number: 11, totalPaise: 50, van: van1, retailer: shop("R-1", "Adhartal"), lines: [detergent(3)] },
  { number: 13, totalPaise: 70, van: van2, retailer: shop("R-3", "Sadar"), lines: [detergent(1)] },
  { number: 14, totalPaise: 30, van: null, retailer: shop("R-9", "Elsewhere"), lines: [biscuit(1)] },
];

describe("van loading lists (D110)", () => {
  const lists = buildLoadingLists(orders);

  it("groups by van, unassigned last", () => {
    expect(lists.map((v) => v.vanCode)).toEqual(["VAN-1", "VAN-2", "UNASSIGNED"]);
  });

  it("loads paid + free cases per SKU", () => {
    const v1 = lists[0];
    expect(v1.skus).toEqual([
      { skuCode: "SKU-BS-075", nameEn: "Glucose biscuit 75 g", paidCases: 15, freeCases: 1, totalCases: 16 },
      { skuCode: "SKU-DT-1KG", nameEn: "Detergent powder 1 kg", paidCases: 5, freeCases: 0, totalCases: 5 },
    ]);
    expect(v1).toMatchObject({ orderCount: 3, totalCases: 21, totalPaise: 350 });
  });

  it("merges a shop's orders into one drop, sorted by area then shop", () => {
    const drops = lists[0].drops;
    expect(drops.map((d) => [d.retailerCode, d.orders])).toEqual([["R-1", [10, 11]], ["R-2", [12]]]);
    expect(drops[0].lines.find((l) => l.skuCode === "SKU-DT-1KG")?.totalCases).toBe(5);
    expect(drops[0].totalPaise).toBe(250);
  });

  it("is empty for no orders", () => {
    expect(buildLoadingLists([])).toEqual([]);
  });
});
