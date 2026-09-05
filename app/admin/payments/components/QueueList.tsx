/** ADMIN layer — the queue itself, oldest first.
 *
 * A rail on a wide screen and a collapsible list on a phone. On a phone the
 * working panel is what matters and the list is navigation, so it starts
 * closed with the count in its label: the screen opens on the item at the top
 * of the queue, which is where a verifier starts anyway.
 */
'use client';

import { useState } from 'react';
import { ChevronDown, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
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

  const heading = `Queue · ${items.length}${capped ? '+' : ''}`;

  const rows = (
    <ul className="divide-y divide-divider">
      {items.map((order) => (
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
        <div className="max-h-[60vh] overflow-y-auto lg:max-h-[calc(100vh-10rem)]">{rows}</div>
      </div>
    </div>
  );
}
