// D108: what a salesman saw when he took an order offline. The phone computes
// it with the same pure pricing engine; on sync the server computes it again
// from today's prices, schemes, stock and credit. Any difference → the order
// is not placed and comes back to him for re-confirmation.

export type ExpectedLine = { skuId: string; paidCases: number; freeCases: number; lineTotalPaise: number };
export type OfflineExpectation = { lines: ExpectedLine[]; totalPaise: number; hold: boolean };

export function expectationOf(lines: readonly ExpectedLine[], totalPaise: number, hold: boolean): OfflineExpectation {
  return {
    lines: lines
      .map(({ skuId, paidCases, freeCases, lineTotalPaise }) => ({ skuId, paidCases, freeCases, lineTotalPaise }))
      .sort((a, b) => a.skuId.localeCompare(b.skuId)),
    totalPaise,
    hold,
  };
}

export function sameExpectation(a: OfflineExpectation, b: OfflineExpectation): boolean {
  return JSON.stringify(expectationOf(a.lines, a.totalPaise, a.hold)) === JSON.stringify(expectationOf(b.lines, b.totalPaise, b.hold));
}
