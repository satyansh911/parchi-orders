// The domain can't import Prisma (lint rule), so it keeps its own status list.
// This test stops the two from drifting apart.
import { describe, expect, it } from "vitest";
import { OrderStatus } from "@/generated/prisma/enums";
import { OPEN_ORDER_STATUSES } from "@/domain/credit/credit";
import { TRANSITIONS } from "@/domain/orders/status-machine";

describe("domain order statuses match the database enum", () => {
  it("uses only statuses the database knows", () => {
    const db = new Set(Object.values(OrderStatus));
    for (const t of TRANSITIONS) {
      if (t.from !== "NEW") expect(db.has(t.from), t.from).toBe(true);
      expect(db.has(t.to), t.to).toBe(true);
    }
    for (const s of OPEN_ORDER_STATUSES) expect(db.has(s), s).toBe(true);
  });

  it("covers every database status in the lifecycle (DRAFT intentionally unused, D12)", () => {
    const used = new Set(TRANSITIONS.flatMap((t) => [t.from, t.to]));
    const unused = Object.values(OrderStatus).filter((s) => !used.has(s));
    expect(unused).toEqual(["DRAFT"]);
  });
});
