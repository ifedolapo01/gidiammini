/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/OrderStatsSummary.tsx
//
// Reads the server's summary rather than reducing an array of orders. Once the
// list is paged, "Total Orders" derived from what the browser holds would read
// 25 — these figures have to be counted where all the rows are.
import { Skeleton } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import type { AdminOrdersSummary } from '@/lib/commerce/admin-orders-summary';

interface OrderStatsSummaryProps {
  summary: AdminOrdersSummary | null;
}

function StatCard({ label, value, tone, note }: { label: string; value: string; tone: string; note?: string }) {
  return (
    <div className="bg-surface p-4 rounded-surface shadow-elevation-1 border border-border">
      <p className="text-body-sm text-text-secondary">{label}</p>
      <p className={`text-h4 font-bold ${tone}`}>{value}</p>
      {note && <p className="text-caption-md text-text-secondary mt-1">{note}</p>}
    </div>
  );
}

export default function OrderStatsSummary({ summary }: OrderStatsSummaryProps) {
  if (!summary) {
    return (
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-24 rounded-surface" />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard label="Total Orders" value={summary.total.toLocaleString()} tone="text-text-primary" />
      <StatCard label="Pending" value={summary.pending.toLocaleString()} tone="text-warning" />
      <StatCard
        label="Total Revenue"
        value={formatCurrency(summary.revenue)}
        tone="text-success"
        note="Excluding cancelled orders"
      />
      <StatCard label="Paid Orders" value={summary.paid.toLocaleString()} tone="text-info" />
    </div>
  );
}
