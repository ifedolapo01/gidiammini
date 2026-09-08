/** ADMIN layer — the storefront funnel: view -> add to cart -> checkout -> purchase.
 *
 * The one number no order-derived panel on this dashboard could ever produce:
 * how many sessions saw a product for every one that bought it. Each stage's
 * bar is sized against the top of the funnel, and the caption between stages
 * is the conversion the operator actually wants — "of the people who added to
 * cart, how many paid".
 */
'use client';

import { TrendingDown } from 'lucide-react';
import { ChartCard } from './charts/ChartCard';
import { useStorefrontAnalytics, type FunnelStage } from '@/app/admin/hooks/useStorefrontAnalytics';

const STAGES: { key: FunnelStage; label: string }[] = [
  { key: 'view_item', label: 'Viewed a product' },
  { key: 'add_to_cart', label: 'Added to cart' },
  { key: 'begin_checkout', label: 'Started checkout' },
  { key: 'purchase', label: 'Purchased' },
];

const WINDOW_DAYS = 30;

export function FunnelPanel() {
  const { funnel, loading, error } = useStorefrontAnalytics(WINDOW_DAYS);

  const countFor = (stage: FunnelStage) => funnel.find((row) => row.event === stage)?.sessions ?? 0;
  const top = countFor('view_item');
  const isEmpty = !loading && !error && top === 0;

  return (
    <ChartCard
      title="Conversion funnel"
      isEmpty={isEmpty}
      emptyMessage={`No storefront traffic recorded in the last ${WINDOW_DAYS} days yet.`}
    >
      {loading ? (
        <div className="space-y-3" aria-hidden="true">
          {STAGES.map((stage) => (
            <div key={stage.key} className="h-10 animate-pulse rounded-control bg-background-secondary" />
          ))}
        </div>
      ) : error ? (
        <p className="py-6 text-center text-body-sm text-destructive">{error}</p>
      ) : (
        <ul className="space-y-3">
          {STAGES.map((stage, index) => {
            const count = countFor(stage.key);
            const widthPercent = top > 0 ? Math.max((count / top) * 100, count > 0 ? 4 : 0) : 0;
            const previous = index > 0 ? countFor(STAGES[index - 1].key) : null;
            const stepConversion = previous && previous > 0 ? Math.round((count / previous) * 100) : null;

            return (
              <li key={stage.key}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-body-sm font-medium text-text-primary">{stage.label}</span>
                  <span className="text-body-sm font-bold text-text-primary">
                    {count.toLocaleString()} session{count === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-background-secondary">
                  <div
                    className="h-3 rounded-full bg-primary transition-all"
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
                {stepConversion !== null && (
                  <p className="mt-1 flex items-center gap-1 text-caption-md text-text-secondary">
                    <TrendingDown size={12} aria-hidden="true" />
                    {stepConversion}% of the previous stage
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </ChartCard>
  );
}
