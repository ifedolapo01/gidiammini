/** ADMIN layer — one editable line of an order.
 *
 * Split out of OrderEditPanel, which is the layout and the totals. This is the
 * row: a product that cannot be changed in place (swapping a variant is a
 * removal and an addition, because it is a different unit of stock), a price
 * and a quantity that can, and a way to take it off.
 *
 * Both numeric inputs clamp on the way out rather than validating on the way
 * in. An operator holding backspace should see the field empty, not fight a
 * control that keeps inserting a 1 — so the clamp happens where the value
 * leaves the row, and the panel's Save is what the server checks anyway.
 */
'use client';

import { Trash2 } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import type { DraftLine } from '../hooks/useOrderEdit';

interface OrderEditLineRowProps {
  line: DraftLine;
  onChange: (key: string, patch: Partial<DraftLine>) => void;
  onRemove: (key: string) => void;
}

export default function OrderEditLineRow({ line, onChange, onRemove }: OrderEditLineRowProps) {
  const variant = [line.size, line.color].filter(Boolean).join(' / ') || 'Standard';

  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-3 rounded-surface bg-background-secondary p-3 sm:grid-cols-[1fr_7rem_5.5rem_auto]">
      <div className="min-w-0">
        <p className="truncate font-medium text-text-primary">{line.product_name}</p>
        <p className="text-caption-md text-text-secondary">{variant}</p>
      </div>

      <div className="order-3 sm:order-none">
        <label className="mb-1 block text-caption-md text-text-secondary" htmlFor={`price-${line.key}`}>
          Unit price
        </label>
        <Input
          id={`price-${line.key}`}
          size="sm"
          type="number"
          min={0}
          step={1}
          value={line.price}
          onChange={(event) =>
            onChange(line.key, { price: Math.max(0, Math.round(Number(event.target.value) || 0)) })
          }
        />
      </div>

      <div className="order-4 sm:order-none">
        <label className="mb-1 block text-caption-md text-text-secondary" htmlFor={`qty-${line.key}`}>
          Qty
        </label>
        <Input
          id={`qty-${line.key}`}
          size="sm"
          type="number"
          min={1}
          max={999}
          step={1}
          value={line.quantity}
          onChange={(event) =>
            onChange(line.key, {
              quantity: Math.min(999, Math.max(1, Math.round(Number(event.target.value) || 1))),
            })
          }
        />
      </div>

      <Button
        size="sm"
        variant="ghost"
        icon
        aria-label={`Remove ${line.product_name}`}
        onClick={() => onRemove(line.key)}
        className="self-end text-destructive"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
