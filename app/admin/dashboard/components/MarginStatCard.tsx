/**
 * ADMIN layer — gross margin beside revenue on the dashboard.
 *
 * Cost is optional per variant, so this card has to be honest about how much of
 * the revenue it could actually account for. A margin computed over a third of
 * the catalogue read as though it covered all of it would be worse than showing
 * nothing — so the coverage is stated whenever it is incomplete, and the card
 * says plainly when no cost has been entered at all.
 *
 * The wording says "items sold", not "revenue", deliberately. This figure is
 * computed from order line prices, while the Revenue Confirmed card beside it
 * shows order totals — which include delivery and tax. The two are not the same
 * number, and inviting the reader to divide one by the other would undo the
 * point of the card.
 */
'use client';

import { TrendingUp } from 'lucide-react';
import { StatCard } from './StatCard';
import { formatCurrency } from '@/lib/commerce/pricing';
import { formatMarginPercent, marginTone, type MarginTotals } from '@/lib/commerce/margin';

const VALUE_CLASS = {
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
  neutral: 'text-text-secondary',
} as const;

export default function MarginStatCard({ margin }: { margin: MarginTotals | null }) {
  const hasAnyCost = margin !== null && margin.costedRevenue > 0;
  const tone = marginTone(margin?.marginPercent ?? null);

  const subtext = !hasAnyCost
    ? 'Add cost prices to see margin'
    : margin.coveragePercent >= 99.5
      ? `${formatMarginPercent(margin.marginPercent)} on items sold`
      : `${formatMarginPercent(margin.marginPercent)} on the ${Math.round(margin.coveragePercent)}% of items with a cost`;

  return (
    <StatCard
      title="Gross Margin"
      icon={<TrendingUp className="w-5 h-5 text-primary" />}
      iconBgClassName="bg-secondary"
      value={hasAnyCost ? formatCurrency(margin.grossMargin) : '—'}
      valueClassName={VALUE_CLASS[tone]}
      subtext={subtext}
    />
  );
}
