/** ADMIN layer — the bulk control for the stock table.
 *
 * One action, because one is what the page needs: set the same figure on every
 * selected variant. It runs behind the shared undo window and reports per-row,
 * since a variant whose product was deleted underneath the operator has to be
 * named rather than silently skipped.
 */
'use client';

import { useState } from 'react';
import { Boxes } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import BulkActionBar from '../../components/BulkActionBar';
import type { PendingBulkAction } from '../../hooks/useBulkAction';

interface StockBulkBarProps {
  selectedIds: string[];
  pending: PendingBulkAction | null;
  running: boolean;
  onSetStock: (ids: string[], stock: number) => void;
  onUndo: () => void;
  onApplyNow: () => void;
  onClear: () => void;
}

export function StockBulkBar({
  selectedIds,
  pending,
  running,
  onSetStock,
  onUndo,
  onApplyNow,
  onClear,
}: StockBulkBarProps) {
  const [stockText, setStockText] = useState('');

  const stock = Number.parseInt(stockText, 10);
  const valid = stockText.trim() !== '' && Number.isFinite(stock) && stock >= 0;

  return (
    <BulkActionBar
      count={selectedIds.length}
      pending={pending}
      running={running}
      onUndo={onUndo}
      onApplyNow={onApplyNow}
      onClear={onClear}
    >
      <div className="flex items-center gap-2">
        <Boxes className="w-4 h-4 text-text-secondary" aria-hidden="true" />
        <label htmlFor="bulk-stock-value" className="text-body-sm text-text-secondary">
          Set stock to
        </label>
        <Input
          id="bulk-stock-value"
          type="number"
          min="0"
          size="sm"
          className="w-24"
          value={stockText}
          onChange={(event) => setStockText(event.target.value)}
        />
        <Button size="sm" disabled={!valid} onClick={() => onSetStock(selectedIds, stock)}>
          Apply to {selectedIds.length} variant{selectedIds.length === 1 ? '' : 's'}
        </Button>
      </div>

      <span className="text-caption-md text-text-secondary">
        Customers waiting on a restock are emailed, as with a single save.
      </span>
    </BulkActionBar>
  );
}
