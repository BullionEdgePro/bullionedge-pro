/**
 * Luxx4less marketplace fees (owner, 2 Oct 2026): listing is free; when a
 * trade completes, the seller owes a commission on the sale price. Pure, so
 * the seller's pages, staff tools and tests read the rules the same way.
 */

export type FeeRules = { feePct: number; feeMinPhp: number | null; feeMaxPhp: number | null };

const cents = (v: number) => Math.round(v * 100) / 100;

/** The commission on one sale: the rate, held between the minimum and maximum when set, never above the sale itself. */
export function feeFor(amountPhp: number, rules: FeeRules): number {
  if (!(amountPhp > 0) || !(rules.feePct > 0)) return 0;
  let fee = cents((amountPhp * rules.feePct) / 100);
  if (rules.feeMinPhp !== null && fee < rules.feeMinPhp) fee = rules.feeMinPhp;
  if (rules.feeMaxPhp !== null && fee > rules.feeMaxPhp) fee = rules.feeMaxPhp;
  return cents(Math.min(fee, amountPhp));
}

/** What the seller keeps after the fee. */
export function sellerNet(amountPhp: number, rules: FeeRules): number {
  return cents(amountPhp - feeFor(amountPhp, rules));
}

/** "3%", "2.5%" — for sellers to read. */
export function feeRateLabel(rules: Pick<FeeRules, "feePct">): string {
  return `${Number(rules.feePct.toFixed(2))}%`;
}

export type FeeLine = { id: string; feePhp: number; releasedAt: Date; dueAt: Date; waived: boolean };

/**
 * Which fees the confirmed payments cover, oldest sale first, and what is
 * still owed. Overpaying leaves a credit that the next fee uses.
 */
export function settleFees(lines: readonly FeeLine[], paidPhp: number, now: Date) {
  const owed = [...lines].filter((l) => !l.waived && l.feePhp > 0).sort((a, b) => +a.releasedAt - +b.releasedAt);
  let left = cents(paidPhp);
  const paid = new Set<string>();
  for (const l of owed) {
    if (left + 0.004 < l.feePhp) break;
    left = cents(left - l.feePhp);
    paid.add(l.id);
  }
  const unpaid = owed.filter((l) => !paid.has(l.id));
  const totalOwed = cents(owed.reduce((s, l) => s + l.feePhp, 0));
  const balance = cents(totalOwed - paidPhp);
  const overdue = unpaid.filter((l) => l.dueAt < now);
  return {
    paid,
    /** Positive: owed. Negative: credit. */
    balance,
    overduePhp: cents(Math.max(0, Math.min(balance, overdue.reduce((s, l) => s + l.feePhp, 0)))),
    overdue: overdue.length > 0,
    nextDueAt: unpaid[0]?.dueAt ?? null,
  };
}
