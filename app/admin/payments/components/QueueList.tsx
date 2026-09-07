/** ADMIN layer — the queue itself, oldest first.
 *
 * A rail on a wide screen and a collapsible list on a phone. On a phone the
 * working panel is what matters and the list is navigation, so it starts
 * closed with the count in its label: the screen opens on the item at the top
 * of the queue, which is where a verifier starts anyway.
 */
'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ListChecks, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui';
import { filterPaymentQueue } from '@/lib/commerce/payment-queue-search';
import type { PaymentQueueItem } from '@/types/payment';
import { QueueRow } from './QueueRow';

interface QueueListProps {
  items: PaymentQueueItem[];
  selectedId: string | null;
  onSelect: (orderId: string) => void;
  /** True when the server capped the page — the list is not everything. */
  capped: boolean;
}

export function QueueList({ items, selectedId, onSelect, capped }: QueueListProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Client-side: the queue is already loaded in full for this screen, so
  // pasting a whole bank alert or typing a name filters without a round trip.
  const filtered = useMemo(() => filterPaymentQueue(items, query), [items, query]);

  const heading = `Queue · ${items.length}${capped ? '+' : ''}`;

  const rows = filtered.length === 0 ? (
    <p className="p-4 text-center text-body-sm text-text-secondary">
      Nothing in the queue matches that.
    </p>
  ) : (
    <ul className="divide-y divide-divider">
      {filtered.map((order) => (
        <QueueRow
          key={order.id}
          order={order}
          active={order.id === selectedId}
          onSelect={(id) => {
            onSelect(id);
            setOpen(false);
          }}
        />
      ))}
    </ul>
  );

  return (
    <div className="rounded-surface border border-border bg-surface lg:sticky lg:top-4">
      {/* Phone: a disclosure. Desktop: a plain heading — the rail is always
          visible there, and a button reporting aria-expanded=false over a list
          that is on screen tells a screen reader the opposite of the truth.
          Two elements rather than one styled both ways, because that is the
          only way the semantics can differ. */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus lg:hidden"
      >
        <ListChecks className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
        <span className="flex-1 text-body-sm font-semibold text-text-primary">{heading}</span>
        <ChevronDown
          className={cn('size-4 text-text-secondary transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      <h2 className="hidden min-h-11 items-center gap-2 px-3 py-2 lg:flex">
        <ListChecks className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
        <span className="text-body-sm font-semibold text-text-primary">{heading}</span>
      </h2>

      <div className={cn('border-t border-divider', open ? 'block' : 'hidden lg:block')}>
        <div className="p-2">
          <label className="relative block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Paste a bank alert, or search a name/phone"
              className="pl-9"
              aria-label="Search the payment queue"
            />
          </label>
        </div>
        <div className="max-h-[60vh] overflow-y-auto lg:max-h-[calc(100vh-10rem)]">{rows}</div>
      </div>
    </div>
  );
}
