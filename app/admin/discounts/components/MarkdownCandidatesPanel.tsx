/** ADMIN layer — stale/dead stock, one tap from becoming a targeted discount.
 *
 * The aging report (app/api/admin/stock/aging) already ranks exactly this list
 * by money tied up. What was missing was a way to act on a row without leaving
 * for the Discounts page and re-typing which product, size and colour it was
 * — so "Create discount" builds that targeting itself and opens the same form
 * every other discount uses, via the reuse-as-template path openModal already
 * has (see useDiscounts.ts).
 */
'use client';

import { PackageSearch, Sparkles } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import { useStockReports } from '@/app/admin/stock/reports/hooks/useStockReports';
import type { ReportRow } from '@/app/admin/stock/reports/hooks/useStockReports';

interface MarkdownCandidatesPanelProps {
  onCreateDiscount: (candidate: ReportRow) => void;
}

export function MarkdownCandidatesPanel({ onCreateDiscount }: MarkdownCandidatesPanelProps) {
  const { reports, loading, error } = useStockReports(90);
  const candidates = reports.aging;

  return (
    <div className="bg-surface rounded-surface shadow-elevation-1 border border-border-light overflow-hidden mb-8">
      <div className="p-4 border-b border-border-light bg-background-secondary flex items-center justify-between">
        <div>
          <h2 className="text-body-lg font-bold text-text-primary">Markdown candidates</h2>
          <p className="text-caption-md text-text-secondary">
            Stale or dead stock, ranked by cash tied up — clear it without going below cost.
          </p>
        </div>
        <span className="bg-primary/10 text-primary text-caption-md font-bold px-2.5 py-1 rounded-full">
          {candidates.length}
        </span>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center">
          <Spinner size="md" className="text-primary" />
        </div>
      ) : error ? (
        <p className="p-6 text-center text-body-sm text-destructive">{error}</p>
      ) : candidates.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <PackageSearch size={32} />
          </div>
          <h3 className="text-body-lg font-bold text-text-primary mb-1">Nothing aging right now</h3>
          <p className="text-text-secondary max-w-md mx-auto">
            Every variant with stock on the shelf has sold within the window this report watches.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border-light">
          {candidates.map((row) => (
            <li key={row.variantId} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-text-primary truncate">
                  {row.productName} <span className="text-text-secondary font-normal">({row.label})</span>
                </p>
                <p className="text-caption-md text-text-secondary">
                  {row.stock} unit{row.stock === 1 ? '' : 's'} on the shelf
                  {row.tiedUpValue != null && <> · {formatCurrency(row.tiedUpValue)} tied up</>}
                  {row.daysSinceLastSale != null
                    ? <> · last sold {row.daysSinceLastSale}d ago</>
                    : <> · never sold in this window</>}
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
