/** ADMIN layer — why the stock number is changing, and what that implies.
 *
 * Split out of StockEditModal so the modal stays about the variant and this
 * stays about the ledger. It is also the stock-take surface: choosing "Stock
 * take" turns the same three fields into a count-and-reconcile, showing the
 * difference between what the system believed and what is actually on the
 * shelf before anything is saved. That difference is the whole value of a
 * stock take — a count that silently overwrites the old number tells nobody
 * that eleven units went missing.
 */
'use client';

import { AlertTriangle } from 'lucide-react';
import { Input, Select } from '@/components/ui';
import {
  STOCK_EDIT_REASON_INFO,
  type StockEditReason,
} from '@/lib/commerce/inventory-movements';

interface StockMovementReasonProps {
  reason: StockEditReason;
  onReasonChange: (reason: StockEditReason) => void;
  note: string;
  onNoteChange: (note: string) => void;
  /** What the system currently believes is on the shelf. */
  expectedStock: number;
  /** What is about to be saved. */
  newStock: number;
}

export function StockMovementReason({
  reason,
  onReasonChange,
  note,
  onNoteChange,
  expectedStock,
  newStock,
}: StockMovementReasonProps) {
  const info = STOCK_EDIT_REASON_INFO.find((option) => option.value === reason);
  const difference = newStock - expectedStock;
  const counting = reason === 'stock_take';

  return (
    <div className="pt-4 border-t border-border-light space-y-4">
      <div>
        <label htmlFor="stock-reason" className="block text-body-sm font-semibold text-text-primary mb-2">
          Why is this changing?
        </label>
        <Select
          id="stock-reason"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value as StockEditReason)}
          aria-describedby="stock-reason-hint"
        >
          {STOCK_EDIT_REASON_INFO.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <p id="stock-reason-hint" className="text-caption-md text-text-secondary mt-2">
          {info?.description}
        </p>
      </div>

      {counting && (
        // The reconciliation. Shown before the save, not after, because the
        // moment to question a count of 3 against an expected 14 is while
        // somebody is still standing at the shelf.
        <div
          role="status"
          className={`rounded-control border p-3 text-body-sm ${
            difference === 0
              ? 'border-success-border bg-success-background text-success'
              : 'border-warning-border bg-warning-background text-warning'
          }`}
        >
          {difference === 0 ? (
            <span>Counted {newStock} — matches the system exactly.</span>
          ) : (
            <span className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                System says {expectedStock}, you counted {newStock} —{' '}
                <strong>
                  {difference > 0 ? `${difference} more` : `${Math.abs(difference)} missing`}
                </strong>
                . Saving records the difference as a stock take.
              </span>
            </span>
          )}
        </div>
      )}

      <div>
        <label htmlFor="stock-note" className="block text-body-sm font-semibold text-text-primary mb-2">
          Note {counting && difference !== 0 ? '' : <span className="font-normal text-text-secondary">(optional)</span>}
        </label>
        <Input
          id="stock-note"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder={
            counting
              ? 'Where the difference came from — damaged, miscounted, taken as a sample…'
              : reason === 'restock'
                ? 'Supplier, invoice number…'
                : 'What was wrong with the old number…'
          }
          maxLength={200}
        />
        <p className="text-caption-md text-text-secondary mt-2">
          Kept on the movement and in the activity feed. A count with no explanation
          for the difference is a number nobody can act on later.
        </p>
      </div>
    </div>
  );
}
