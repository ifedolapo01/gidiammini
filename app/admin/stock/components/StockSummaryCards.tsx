/** ADMIN layer — summary metric cards for the stock management page.
 *
 * Counted in the database rather than derived from the rows on screen: the
 * table is one page now, so "Out of Stock" filtered from what the browser
 * holds would only ever count this page's variants.
 */
import { Skeleton } from '@/components/ui';
import type { AdminProductsSummary } from '@/lib/commerce/admin-products-summary';

interface StockSummaryCardsProps {
  summary: AdminProductsSummary | null;
}

function Card({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="bg-surface p-4 rounded-surface shadow-elevation-1 border border-border">
      <p className="text-body-sm text-text-secondary">{label}</p>
      <p className={`text-h4 font-bold ${tone}`}>{value.toLocaleString()}</p>
    </div>
  );
}

export function StockSummaryCards({ summary }: StockSummaryCardsProps) {
  if (!summary) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 md:mb-8">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-[76px] rounded-surface" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 md:mb-8">
      <Card label="Main Products" value={summary.products} tone="text-primary" />
      <Card label="Total Variations" value={summary.variants} tone="text-accent" />
      <Card
        label={`Low Stock (${summary.lowStockThreshold} or less)`}
        value={summary.lowStock}
        tone="text-warning"
      />
      <Card label="Out of Stock" value={summary.outOfStock} tone="text-destructive" />
    </div>
  );
}
