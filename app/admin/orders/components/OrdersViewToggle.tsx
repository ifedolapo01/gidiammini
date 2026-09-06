/**
 * ADMIN layer — cards or table, for the orders list.
 *
 * Two views of the same page of orders, because they answer different
 * questions: cards for triage (one order at a time, with its context and its
 * status control), a table for volume (a column you can run your eye down).
 * Neither is a downgrade of the other, so this is a choice and not a setting
 * buried somewhere.
 *
 * Same shape as DensityToggle deliberately — they sit next to each other.
 */
'use client';

import { LayoutGrid, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type OrdersView = 'cards' | 'table';

interface OrdersViewToggleProps {
  view: OrdersView;
  onChange: (view: OrdersView) => void;
  className?: string;
}

const OPTIONS: Array<{ value: OrdersView; label: string; Icon: typeof LayoutGrid }> = [
  { value: 'cards', label: 'Card view', Icon: LayoutGrid },
  { value: 'table', label: 'Table view', Icon: Table2 },
];

export default function OrdersViewToggle({ view, onChange, className }: OrdersViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="Order list layout"
      className={cn('inline-flex rounded-control border border-border-strong p-0.5', className)}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = view === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            aria-pressed={active}
            title={label}
            className={cn(
              'inline-flex size-8 items-center justify-center rounded-[calc(var(--control-radius)-2px)] transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
