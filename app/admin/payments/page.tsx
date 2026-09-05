/** ADMIN layer — the payment verification queue.
 *
 * Depends only on Core (tokens + primitives) and Commerce. No storefront
 * branding.
 *
 * WHY THIS IS A SCREEN AND NOT A MODAL
 *
 * Verifying a transfer is the highest-frequency, highest-stakes thing anybody
 * does in this admin, and until now it had the least structure: open the
 * receipt in a modal over the orders list, compare it mentally with a banking
 * app, then set the status to 'confirmed' and hope. No amount recorded, no
 * reference, no way to say "he sent 18 of 20", no way to refuse a receipt with
 * a reason. A queue with one item open at a time turns that into a sequence
 * somebody can finish.
 *
 * BUILT FOR A PHONE
 *
 * This is genuinely done standing up, with a banking app in the other hand, so
 * the phone layout is the real one: a single column, the receipt at full
 * width, the figures above it where a thumb is not covering them, 44px
 * targets, and the queue collapsed behind a disclosure so the work is what is
 * on screen. The two-column rail appears from `lg` and is the variant, not the
 * default.
 */
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import LiveIndicator from '../components/LiveIndicator';
import { Button } from '@/components/ui';
import { usePaymentQueue } from './hooks/usePaymentQueue';
import { useRecordPayment } from './hooks/useRecordPayment';
import { QueueList } from './components/QueueList';
import { QueueSummary } from './components/QueueSummary';
import { VerifyPanel } from './components/VerifyPanel';
import { PaymentsSkeleton } from './components/PaymentsSkeleton';

function AdminPaymentsContent() {
  // The dashboard worklist links here as ?order=<id>, so a receipt noticed on
  // the dashboard opens on the receipt rather than on the front of the queue.
  const searchParams = useSearchParams();

  const { items, summary, loading, error, live, selected, selectedId, select, advance, reload } =
    usePaymentQueue({ preferredOrderId: searchParams?.get('order') });

  const { record, saving, error: saveError, clearError } = useRecordPayment({ onRecorded: advance });

  if (loading && items.length === 0) return <PaymentsSkeleton />;

  if (error) {
    return (
      <div className="rounded-surface border border-destructive-border bg-destructive-background p-6">
        <h1 className="text-h5 font-semibold text-destructive">Could not load the queue</h1>
        <p className="mt-2 text-body-sm text-destructive">{error}</p>
        <Button variant="destructive" className="mt-4" onClick={() => reload()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-h4 font-bold text-text-primary md:text-h3">Verify payments</h1>
        <p className="mt-1 flex flex-wrap items-center gap-3 text-body-sm text-text-secondary" aria-live="polite">
          <span>
            {summary.waiting === 0
              ? 'Nothing waiting on payment.'
              : `${summary.waiting} order${summary.waiting === 1 ? '' : 's'} waiting on payment`}
          </span>
          <LiveIndicator live={live} subject="payments" />
        </p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-surface border border-success-border bg-success-background p-8 text-center md:p-12">
          <CheckCircle2 className="mx-auto mb-4 size-12 text-success" aria-hidden="true" />
          <h2 className="text-h5 font-semibold text-text-primary">Every payment is accounted for</h2>
          <p className="mt-2 text-body-sm text-text-secondary">
            Nothing is waiting to be verified. New receipts appear here as customers upload them.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <QueueSummary summary={summary} />
          </div>

          {/* The rail is fixed-width and the panel takes the rest, with
              min-w-0 so a long customer name or a wide receipt scrolls inside
              the panel instead of stretching the page. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <QueueList
              items={items}
              selectedId={selectedId}
              onSelect={select}
              capped={summary.capped}
            />

            {selected ? (
              <VerifyPanel
                order={selected}
                saving={saving}
                error={saveError}
                onSubmit={record}
                onDismissError={clearError}
              />
            ) : (
              <div className="rounded-surface border border-border bg-surface p-8 text-center text-text-secondary">
                <p className="text-body-sm">Pick an order from the queue to verify it.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminPaymentsPage() {
  // useSearchParams suspends, so the skeleton is the fallback rather than a
  // blank screen — same pattern as the orders page.
  return (
    <Suspense fallback={<PaymentsSkeleton />}>
      <AdminPaymentsContent />
    </Suspense>
  );
}
