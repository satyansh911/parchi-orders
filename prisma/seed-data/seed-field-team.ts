import type { PrismaClient } from "../../src/generated/prisma/client";
import { SALESMEN, VANS, vanForArea } from "./people";

/**
 * Vans, salesmen and their shop assignments (D109, D110). Idempotent and
 * additive: it never deletes anything, and only fills assignments that are
 * still empty, so it is safe to run against an existing demo database.
 */
export async function seedFieldTeam(db: PrismaClient) {
  const vanIds = new Map<string, string>();
  for (const van of VANS) {
    const row = await db.van.upsert({ where: { code: van.code }, update: { name: van.name }, create: { code: van.code, name: van.name } });
    vanIds.set(van.code, row.id);
  }
  const salesmanByVan = new Map<string, string>();
  for (const s of SALESMEN) {
    const row = await db.user.upsert({ where: { phone: s.phone }, update: {}, create: { phone: s.phone, name: s.name, role: "SALESMAN" } });
    salesmanByVan.set(s.van, row.id);
  }
  const retailers = await db.retailer.findMany({ select: { id: true, area: true, vanId: true, salesmanId: true } });
  let assigned = 0;
  for (const r of retailers) {
    const van = vanForArea(r.area);
    if (r.vanId && r.salesmanId) continue;
    await db.retailer.update({ where: { id: r.id }, data: { vanId: r.vanId ?? vanIds.get(van)!, salesmanId: r.salesmanId ?? salesmanByVan.get(van)! } });
    assigned++;
  }
  return { vans: VANS.length, salesmen: SALESMEN.length, assigned };
}
