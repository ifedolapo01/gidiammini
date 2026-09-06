/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/stock/reports/page.tsx — what to buy, what to clear, and what the
// next size run should look like.
//
// The Stock page answers "how many are there". These are the three questions
// it cannot: what is about to run out, what has been sitting long enough to be
// worth discounting, and which sizes the shop keeps getting wrong. All three
// read the inventory_movements ledger, which cannot be backfilled — so the
// page states how much history it has before it states anything else. A
// reorder suggestion from four days of data is a guess and has to look like one.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button, ErrorState, Select } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import { MIN_CONFIDENT_DAYS } from '@/lib/commerce/inventory-analytics';
import { useStockReports } from './hooks/useStockReports';
import { ReorderTable, AgingTable } from './components/ReorderTable';
import { SizeRunPanel } from './components/SizeRunPanel';
import { ReportsSkeleton } from './components/ReportsSkeleton';

const WINDOWS = [
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 180, label: 'Last 6 months' },
  { value: 365, label: 'Last year' },
];

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface border border-border rounded-surface shadow-elevation-1 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-border-light">
        <h2 className="text-body-lg font-bold text-text-primary">{title}</h2>
        <p className="text-body-sm text-text-secondary mt-1">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default function StockReportsPage() {
  const [windowDays, setWindowDays] = useState(90);
  const { reports, loading, error, reload } = useStockReports(windowDays);

  if (loading) return <ReportsSkeleton />;

  if (error) {
    return (
      <ErrorState
        title="Stock reports could not be loaded"
        description={error}
        actions={<Button onClick={reload}>Try again</Button>}
      />
    );
  }

  const { observedDays, policy, totals } = reports;
  const thin = observedDays < MIN_CONFIDENT_DAYS;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/stock"
            className="inline-flex items-center gap-1 text-body-sm text-text-secondary hover:text-text-primary mb-1"
          >
            <ArrowLeft size={16} aria-hidden />
            Stock
          </Link>
          <h1 className="text-h4 font-bold text-text-primary">Reorder &amp; aging</h1>
          <p className="text-text-secondary">
            Reordering at {policy.leadDays} days lead time plus {policy.coverDays} days cover.{' '}
            <Link href="/admin/settings" className="text-primary hover:text-primary-hover">
              Change
            </Link>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="report-window" className="sr-only">Reporting window</label>
          <Select
            id="report-window"
            value={String(windowDays)}
            onChange={(event) => setWindowDays(Number(event.target.value))}
          >
            {WINDOWS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
          <Button variant="secondary" onClick={reload} loading={loading}>
            <RefreshCw size={16} aria-hidden />
            Refresh
          </Button>
        </div>
      </div>

      {/* Said once, at the top, rather than repeated in every cell. The ledger
          began when the migration ran and cannot be backfilled, so for the
          first fortnight every rate on this page is a small sample. */}
      {thin && (
        <p
          role="status"
          className="rounded-control border border-info-border bg-info-background p-3 text-body-sm text-info"
        >
          {observedDays === 0
            ? 'No stock movements recorded yet. These reports fill in as orders are placed and stock is received — there is no history to work from before that.'
            : `Based on ${observedDays} day${observedDays === 1 ? '' : 's'} of stock history. Treat the rates below as early signals rather than settled figures until there are at least ${MIN_CONFIDENT_DAYS} days.`}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Due a reorder', value: String(totals.reorderCount) },
          { label: 'Not moving', value: String(totals.agingCount) },
          {
            label: 'Cash in slow stock',
            value: totals.tiedUpValue > 0 ? formatCurrency(totals.tiedUpValue) : '—',
          },
        ].map((card) => (
          <div key={card.label} className="bg-surface border border-border rounded-surface shadow-elevation-1 p-4">
            <p className="text-caption-md text-text-secondary uppercase tracking-wide">{card.label}</p>
            <p className="text-h5 font-bold text-text-primary mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      <Panel
        title="Running out"
        description="Selling lines at or below their reorder point, soonest first. The buy quantity brings each back to a full lead time plus cover."
      >
        <ReorderTable rows={reports.reorder} />
      </Panel>

      <Panel
        title="Not moving"
        description="Stocked lines that have not sold in 60 days or more, ranked by the money sitting in them. Cash shown at cost, where a cost price is recorded."
      >
        <AgingTable rows={reports.aging} />
      </Panel>

      <Panel
        title="Size run"
        description="How each size sells relative to the others, not relative to how much of it you bought. Above the line, buy more of it next time."
      >
        <SizeRunPanel sizes={reports.sizes} />
      </Panel>
    </div>
  );
}
