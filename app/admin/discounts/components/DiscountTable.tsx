/** ADMIN layer — active/history discount table with per-row actions. */
'use client';

import { Percent, Tag, Calendar, Send, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui';
import { Discount, formatDiscountValue } from '@/lib/commerce/discounts';
import { formatTarget } from '@/lib/commerce/discount-target';
import type { Category, Product } from '@/types/product';

interface DiscountTableProps {
  discounts: Discount[];
  isHistory: boolean;
  categories: Category[];
  products: Product[];
  onToggleStatus: (discount: Discount) => void;
  onReuse: (discount: Discount) => void;
  onEdit: (discount: Discount) => void;
  onDelete: (id: string) => void;
  onNotify: (discount: Discount) => void;
}

export function DiscountTable({
  discounts: tableDiscounts,
  isHistory,
  categories,
  products,
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
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-background-secondary border-b border-border-light text-body-sm text-text-secondary uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Name & Value</th>
                <th className="px-6 py-4 font-semibold">Scope</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Dates</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {tableDiscounts.map((discount) => (
                <tr key={discount.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-control flex items-center justify-center ${discount.type === 'PERCENTAGE' ? 'bg-accent/10 text-accent' : 'bg-success-background text-success'}`}>
                        {discount.type === 'PERCENTAGE' ? <Percent size={20} /> : <span className="font-bold">₦</span>}
                      </div>
                      <div>
                        <p className="font-bold text-text-primary">{discount.name}</p>
                        <p className="text-body-sm text-text-secondary font-medium">
                          {formatDiscountValue(discount)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
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
                  <td className="px-6 py-4">
                    {!isHistory ? (
                      <button
                        onClick={() => onToggleStatus(discount)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${discount.is_active ? 'bg-success' : 'bg-disabled'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-surface transition-transform ${discount.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    ) : (
                      <Badge tone="destructive" variant="solid" className="font-semibold uppercase tracking-wider">
                        Inactive
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-4">
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
                  <td className="px-6 py-4 text-right">
                    {isHistory ? (
                      <div className="flex justify-end items-center gap-2">
                        <button
                          onClick={() => onReuse(discount)}
                          className="text-text-secondary hover:text-primary p-2 transition-colors flex items-center gap-1 text-body-sm font-medium border border-border rounded-control hover:border-primary/30 bg-surface shadow-elevation-1"
                          title="Reuse Discount"
                        >
                          <Calendar size={16} /> Reuse
                        </button>
                        <button onClick={() => onDelete(discount.id)} className="text-text-muted hover:text-destructive p-2 transition-colors" title="Delete Discount">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end items-center">
                        <button
                          onClick={() => onNotify(discount)}
                          className="text-text-muted hover:text-success p-2 transition-colors"
                          title="Notify Subscribers"
                        >
                          <Send size={18} />
                        </button>
                        <button onClick={() => onEdit(discount)} className="text-text-muted hover:text-primary p-2 transition-colors" title="Edit Discount">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => onDelete(discount.id)} className="text-text-muted hover:text-destructive p-2 transition-colors" title="Delete Discount">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
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
