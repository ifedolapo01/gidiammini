/** ADMIN layer — what to buy, and what is not moving. Presentation only.
 *
 * Two tables from one component because they are the same row rendered against
 * a different question: what is about to run out, and what has been sitting
 * too long. Sharing the shell keeps them visually comparable, which matters —
 * they are read one after the other and the second is the money to fund the
 * first.
 */
'use client';

import Link from 'next/link';
import { Package } from 'lucide-react';
import { Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import type { ReportRow } from '../hooks/useStockReports';

function VariantCell({ row }: { row: ReportRow }) {
  return (
    <div className="min-w-0">
      <Link
        href={`/admin/products/${row.productId}`}
        className="font-medium text-text-primary hover:text-primary truncate block"
      >
        {row.productName}
      </Link>
      <span className="text-caption-md text-text-secondary">{row.label}</span>
    </div>
  );
}

function EmptyReport({ message }: { message: string }) {
  return (
    <div className="p-8 text-center">
      <Package className="w-10 h-10 text-text-muted mx-auto mb-3" aria-hidden />
      <p className="text-text-secondary">{message}</p>
    </div>
  );
}

/** Rounds a rate to something a person reads. 0.4 a day is "0.4/day"; 12 a day
 *  does not need a decimal. */
function rate(velocity: number): string {
  return `${velocity >= 10 ? Math.round(velocity) : velocity.toFixed(1)}/day`;
}

function cover(days: number | null): string {
  if (days === null) return '—';
  if (days < 1) return 'Under a day';
  return `${Math.round(days)} days`;
}

export function ReorderTable({ rows }: { rows: ReportRow[] }) {
  if (rows.length === 0) {
    return <EmptyReport message="Nothing is due a reorder. Everything selling has enough cover." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-background-secondary">
          <tr>
            {['Variant', 'Selling', 'Left', 'Cover', 'Reorder at', 'Buy'].map((heading) => (
              <th
                key={heading}
                scope="col"
                className="px-4 py-3 text-left text-caption-md font-semibold text-text-secondary uppercase tracking-wide"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light">
          {rows.map((row) => (
            <tr key={row.variantId} className="hover:bg-surface-hover">
              <td className="px-4 py-3"><VariantCell row={row} /></td>
              <td className="px-4 py-3 text-body-sm text-text-secondary whitespace-nowrap">{rate(row.velocity)}</td>
              <td className="px-4 py-3 text-body-sm font-medium text-text-primary">{row.stock}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                <Badge tone={(row.daysOfCover ?? 99) < 7 ? 'destructive' : 'warning'}>
                  {cover(row.daysOfCover)}
                </Badge>
              </td>
              <td className="px-4 py-3 text-body-sm text-text-secondary">{row.reorderPoint}</td>
              <td className="px-4 py-3 text-body-sm font-bold text-text-primary">{row.suggestedOrder}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AgingTable({ rows }: { rows: ReportRow[] }) {
  if (rows.length === 0) {
    return <EmptyReport message="Nothing has been sitting unsold. Every stocked line has moved recently." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-background-secondary">
          <tr>
            {['Variant', 'Last sold', 'Left', 'Tied up', ''].map((heading, index) => (
              <th
                key={heading || index}
                scope="col"
                className="px-4 py-3 text-left text-caption-md font-semibold text-text-secondary uppercase tracking-wide"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light">
          {rows.map((row) => (
            <tr key={row.variantId} className="hover:bg-surface-hover">
              <td className="px-4 py-3"><VariantCell row={row} /></td>
              <td className="px-4 py-3 text-body-sm text-text-secondary whitespace-nowrap">
                {row.daysSinceLastSale === null
                  ? 'Never, since records began'
                  : `${row.daysSinceLastSale} days ago`}
              </td>
              <td className="px-4 py-3 text-body-sm font-medium text-text-primary">{row.stock}</td>
              <td className="px-4 py-3 text-body-sm text-text-primary whitespace-nowrap">
                {row.tiedUpValue === null
                  ? <span className="text-text-muted" title="No cost price recorded for this variant">—</span>
                  : formatCurrency(row.tiedUpValue)}
              </td>
              <td className="px-4 py-3">
                <Badge tone={row.momentum === 'dead' ? 'destructive' : 'warning'}>
                  {row.momentum === 'dead' ? 'Dead' : 'Stale'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
