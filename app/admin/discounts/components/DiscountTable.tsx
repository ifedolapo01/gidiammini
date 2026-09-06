/** ADMIN layer — active/history discount table with per-row actions. */
'use client';

import { Percent, Tag, Calendar, Send, Edit2, Trash2 } from 'lucide-react';
import { STICKY_HEAD, TABLE_SCROLL } from '../../components/table';
import { format } from 'date-fns';
import { Badge, Spinner } from '@/components/ui';
import { Discount } from '@/lib/commerce/discounts';
import type { DiscountPerformance } from '@/lib/commerce/discount-performance';
import DiscountPerformanceCell from './DiscountPerformanceCell';
import DiscountNameCell from './DiscountNameCell';
import RowActionsMenu from '@/app/admin/components/RowActionsMenu';
import { formatTarget } from '@/lib/commerce/discount-target';
import type { Category, Product } from '@/types/product';

interface DiscountTableProps {
  discounts: Discount[];
  isHistory: boolean;
  categories: Category[];
  products: Product[];
  pendingId: string | null;
  onToggleStatus: (discount: Discount) => void;
  onReuse: (discount: Discount) => void;
  onEdit: (discount: Discount) => void;
  onDelete: (id: string) => void;
  onNotify: (discount: Discount) => void;
  /** Keyed by discount id. Empty until the second request lands. */
  performance: Record<string, DiscountPerformance>;
  /** The figures could not be read at all — distinct from a discount nobody
   *  has used, which reads identically as a row of zeroes. */
  performanceUnavailable: boolean;
}

export function DiscountTable({
  discounts: tableDiscounts,
  isHistory,
  categories,
  products,
  pendingId,
  performance,
  performanceUnavailable,
  onToggleStatus,
  onReuse,
  onEdit,
  onDelete,
  onNotify,
}: DiscountTableProps) {
  return (
    <div className="bg-surface rounded-surface shadow-elevation-1 border border-border-light overflow-hidden mb-8">
      <div className="p-4 border-b border-border-light bg-background-secondary flex items-center justify-between">
        <h2 className="text-body-lg font-bold text-text-primary">{isHistory ? 'Discount History' : 'Active Discounts'}</h2>
        <span className="bg-primary/10 text-primary text-caption-md font-bold px-2.5 py-1 rounded-full">{tableDiscounts.length}</span>
      </div>
      {tableDiscounts.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <Percent size={32} />
          </div>
          <h3 className="text-body-lg font-bold text-text-primary mb-1">No {isHistory ? 'historical' : 'active'} discounts yet</h3>
          <p className="text-text-secondary max-w-md mx-auto">
            {isHistory
              ? 'When your active discounts expire, they will appear here.'
              : 'Create a discount to boost your sales. You can apply discounts sitewide, by category, or to specific products.'}
          </p>
        </div>
      ) : (
        <div className={TABLE_SCROLL} tabIndex={0} role="region" aria-label="Discounts table">
          <table className="w-full text-left">
            {/* Sticky, so the six column labels are still there at the bottom
                of a long history list. */}
            <thead className={STICKY_HEAD}>
              <tr className="border-b border-border-light text-body-sm text-text-secondary uppercase tracking-wider">
                <th className="px-4 py-3 font-semibold">Name &amp; value</th>
                <th className="px-4 py-3 font-semibold">Scope</th>
                <th className="px-4 py-3 font-semibold w-24">Status</th>
                <th className="px-4 py-3 font-semibold w-32">Dates</th>
                <th className="px-4 py-3 font-semibold">Performance</th>
                <th className="px-4 py-3 font-semibold text-right w-16">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {tableDiscounts.map((discount) => (
                <tr key={discount.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-4 py-4 align-top">
                    <DiscountNameCell discount={discount} />
                  </td>
                  <td className="px-4 py-4 align-top">
                    <Badge tone="info" variant="subtle" className="font-semibold uppercase tracking-wider">
                      <Tag size={12} />
                      {discount.scope}
                    </Badge>
                    {discount.scope !== 'SITEWIDE' && (
                      <p className="text-caption-md text-text-secondary mt-1" title={formatTarget(discount, categories, products)}>
                        Target: <span className="font-medium text-text-primary">{formatTarget(discount, categories, products)}</span>
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    {!isHistory ? (
                      <button
                        onClick={() => onToggleStatus(discount)}
                        disabled={pendingId === discount.id}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 disabled:pointer-events-none ${discount.is_active ? 'bg-success' : 'bg-disabled'}`}
                      >
                        {pendingId === discount.id ? (
                          <Spinner size="xs" className="mx-auto text-text-inverse" />
                        ) : (
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-surface transition-transform ${discount.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                        )}
                      </button>
                    ) : (
                      <Badge tone="destructive" variant="solid" className="font-semibold uppercase tracking-wider">
                        Inactive
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    {(discount.start_date || discount.end_date) ? (
                      <div className="text-body-sm text-text-secondary space-y-1 flex flex-col justify-center">
                        {discount.start_date && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-success"></span>
                            {format(new Date(discount.start_date), 'MMM d, yyyy')}
                          </div>
                        )}
                        {discount.end_date && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-destructive"></span>
                            {format(new Date(discount.end_date), 'MMM d, yyyy')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-body-sm text-text-secondary italic">No expiry</span>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <DiscountPerformanceCell
                      performance={performance[discount.id]}
                      unavailable={performanceUnavailable}
                    />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <RowActionsMenu
                      rowLabel={discount.name}
                      busy={pendingId === discount.id}
                      actions={
                        isHistory
                          ? [
                              {
                                label: 'Reuse',
                                icon: <Calendar size={15} aria-hidden />,
                                onClick: () => onReuse(discount),
                              },
                              {
                                label: 'Delete',
                                icon: <Trash2 size={15} aria-hidden />,
                                onClick: () => onDelete(discount.id),
                                destructive: true,
                              },
                            ]
                          : [
                              {
                                label: 'Notify subscribers',
                                icon: <Send size={15} aria-hidden />,
                                onClick: () => onNotify(discount),
                              },
                              {
                                label: 'Edit',
                                icon: <Edit2 size={15} aria-hidden />,
                                onClick: () => onEdit(discount),
                              },
                              {
                                label: 'Delete',
                                icon: <Trash2 size={15} aria-hidden />,
                                onClick: () => onDelete(discount.id),
                                destructive: true,
                              },
                            ]
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
