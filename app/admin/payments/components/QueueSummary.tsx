/** ADMIN layer — how much of this queue can actually be cleared right now.
 *
 * Three numbers, not one. "12 waiting" is demoralising and, worse, wrong about
 * the work: if nine of them have no receipt yet, the morning's job is three
 * decisions and nine customers to leave alone. Splitting them is the whole
 * point of counting.
 */
'use client';

import { FileImage, HandCoins, Hourglass } from 'lucide-react';
import type { PaymentQueueSummary } from '../hooks/usePaymentQueue';

const TILES = [
  {
    key: 'withReceipt' as const,
    label: 'Receipts to check',
    icon: FileImage,
    tone: 'text-info',
    background: 'bg-info-background',
  },
  {
    key: 'partPaid' as const,
    label: 'Part paid',
    icon: HandCoins,
    tone: 'text-warning',
    background: 'bg-warning-background',
  },
  {
    key: 'awaitingReceipt' as const,
    label: 'No receipt yet',
    icon: Hourglass,
    tone: 'text-text-secondary',
    background: 'bg-background-tertiary',
  },
];

interface QueueSummaryProps {
  summary: PaymentQueueSummary;
}

export function QueueSummary({ summary }: QueueSummaryProps) {
  return (
    <dl className="grid grid-cols-3 gap-2 sm:gap-3">
      {TILES.map(({ key, label, icon: Icon, tone, background }) => (
        <div key={key} className={`rounded-surface border border-border p-3 ${background}`}>
          <dt className="flex items-center gap-1.5 text-caption-md text-text-secondary">
            <Icon className={`size-3.5 shrink-0 ${tone}`} aria-hidden="true" />
            <span className="truncate">{label}</span>
          </dt>
          <dd className={`mt-1 text-h5 font-bold tabular-nums ${tone}`}>{summary[key]}</dd>
        </div>
      ))}
    </dl>
  );
}
