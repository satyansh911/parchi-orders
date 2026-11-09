// D110: van loading lists. Pure: groups the day's approved orders by van,
// totals the cases to load per SKU (paid + free, since free goods ship too)
// and builds a drop sheet per shop in a stable order.

export type LoadingOrder = {
  number: number;
  totalPaise: number;
  van: { code: string; name: string } | null;
  retailer: { code: string; shopName: string; area: string };
  lines: Array<{ skuCode: string; nameEn: string; paidCases: number; freeCases: number }>;
};

export type SkuLoad = { skuCode: string; nameEn: string; paidCases: number; freeCases: number; totalCases: number };
export type Drop = { retailerCode: string; shopName: string; area: string; orders: number[]; totalPaise: number; lines: SkuLoad[] };
export type VanLoad = { vanCode: string; vanName: string; orderCount: number; totalCases: number; totalPaise: number; skus: SkuLoad[]; drops: Drop[] };

export const UNASSIGNED = { code: "UNASSIGNED", name: "No van assigned" } as const;

function addLine(map: Map<string, SkuLoad>, l: LoadingOrder["lines"][number]) {
  const cur = map.get(l.skuCode) ?? { skuCode: l.skuCode, nameEn: l.nameEn, paidCases: 0, freeCases: 0, totalCases: 0 };
  cur.paidCases += l.paidCases;
  cur.freeCases += l.freeCases;
  cur.totalCases += l.paidCases + l.freeCases;
  map.set(l.skuCode, cur);
}
const bySku = (a: SkuLoad, b: SkuLoad) => a.skuCode.localeCompare(b.skuCode);

export function buildLoadingLists(orders: readonly LoadingOrder[]): VanLoad[] {
  const vans = new Map<string, { name: string; orders: LoadingOrder[] }>();
  for (const o of orders) {
    const van = o.van ?? UNASSIGNED;
    const entry = vans.get(van.code) ?? { name: van.name, orders: [] };
    entry.orders.push(o);
    vans.set(van.code, entry);
  }
  return [...vans.entries()]
    .sort(([a], [b]) => (a === UNASSIGNED.code ? 1 : b === UNASSIGNED.code ? -1 : a.localeCompare(b)))
    .map(([vanCode, { name, orders: list }]) => {
      const skus = new Map<string, SkuLoad>();
      const drops = new Map<string, { drop: Drop; lines: Map<string, SkuLoad> }>();
      for (const o of [...list].sort((a, b) => a.number - b.number)) {
        const fresh: Drop = { retailerCode: o.retailer.code, shopName: o.retailer.shopName, area: o.retailer.area, orders: [], totalPaise: 0, lines: [] };
        const d = drops.get(o.retailer.code) ?? { drop: fresh, lines: new Map<string, SkuLoad>() };
        d.drop.orders.push(o.number);
        d.drop.totalPaise += o.totalPaise;
        for (const l of o.lines) {
          addLine(skus, l);
          addLine(d.lines, l);
        }
        drops.set(o.retailer.code, d);
      }
      const dropList = [...drops.values()]
        .map(({ drop, lines }) => ({ ...drop, lines: [...lines.values()].sort(bySku) }))
        .sort((a, b) => a.area.localeCompare(b.area) || a.shopName.localeCompare(b.shopName));
      const skuList = [...skus.values()].sort(bySku);
      return {
        vanCode,
        vanName: name,
        orderCount: list.length,
        totalCases: skuList.reduce((s, x) => s + x.totalCases, 0),
        totalPaise: list.reduce((s, o) => s + o.totalPaise, 0),
        skus: skuList,
        drops: dropList,
      };
    });
}
