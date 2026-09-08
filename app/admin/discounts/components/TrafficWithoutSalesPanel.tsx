/** ADMIN layer — products with real traffic and no sale to show for it.
 *
 * MarkdownCandidatesPanel answers "what's been sitting on the shelf, by cash
 * tied up" — a question orders alone can answer. This answers the one orders
 * alone cannot: "what are people looking at and not buying". A product with
 * 400 views and two sales never shows up in an aging report, because nothing
 * about its stock looks wrong — the problem is upstream of the shelf.
 *
 * "Create discount" opens the same form MarkdownCandidatesPanel's button does,
 * scoped to the whole product rather than one variant: traffic here is
 * aggregated across every size and colour, so there is no single variant to
 * target.
 */
'use client';

import { Eye, ShoppingCart, Sparkles, TrendingUp } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import { useStorefrontAnalytics, type TrafficCandidate } from '@/app/admin/hooks/useStorefrontAnalytics';

const WINDOW_DAYS = 30;

interface TrafficWithoutSalesPanelProps {
  onCreateDiscount: (candidate: TrafficCandidate) => void;
}

export function TrafficWithoutSalesPanel({ onCreateDiscount }: TrafficWithoutSalesPanelProps) {
  const { trafficWithoutSales, loading, error } = useStorefrontAnalytics(WINDOW_DAYS);

  return (
    <div className="bg-surface rounded-surface shadow-elevation-1 border border-border-light overflow-hidden mb-8">
      <div className="p-4 border-b border-border-light bg-background-secondary flex items-center justify-between">
        <div>
          <h2 className="text-body-lg font-bold text-text-primary">Traffic without sales</h2>
          <p className="text-caption-md text-text-secondary">
            Viewed or added to cart in the last {WINDOW_DAYS} days, bought by nobody in that window.
          </p>
        </div>
        <span className="bg-primary/10 text-primary text-caption-md font-bold px-2.5 py-1 rounded-full">
          {trafficWithoutSales.length}
        </span>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center">
          <Spinner size="md" className="text-primary" />
        </div>
      ) : error ? (
        <p className="p-6 text-center text-body-sm text-destructive">{error}</p>
      ) : trafficWithoutSales.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <TrendingUp size={32} />
          </div>
          <h3 className="text-body-lg font-bold text-text-primary mb-1">Nothing looked-at-and-passed-on</h3>
          <p className="text-text-secondary max-w-md mx-auto">
            Either traffic is quiet, or everyone who looked went on to buy.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border-light">
          {trafficWithoutSales.map((row) => (
            <li key={row.productId} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-text-primary truncate">{row.productName}</p>
                <p className="text-caption-md text-text-secondary flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Eye size={13} aria-hidden="true" /> {row.views} view{row.views === 1 ? '' : 's'}
                  </span>
                  <span className="flex items-center gap-1">
                    <ShoppingCart size={13} aria-hidden="true" /> {row.addToCarts} add{row.addToCarts === 1 ? '' : 's'} to cart
                  </span>
                  · {formatCurrency(row.price)} · {row.stock} in stock
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => onCreateDiscount(row)}
              >
                <Sparkles size={16} />
                Create discount
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
