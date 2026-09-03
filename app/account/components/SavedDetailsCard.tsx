/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// The delivery details checkout will prefill from.
//
// Shown rather than hidden, because "we remember your address" is only
// reassuring if the customer can see *which* address we remember — and if it
// is the old one, they need to know that before they reach the last step.
//
// Not editable here on purpose. The address is derived from the most recent
// order that had one, so the way to change it is to place an order with the
// new one; an editable copy would be a second source of truth that silently
// disagrees with every order already shipped.
import { MapPin } from 'lucide-react';
import type { SavedDetails } from '@/lib/commerce/account-query';

interface SavedDetailsCardProps {
  saved: SavedDetails;
}

export function SavedDetailsCard({ saved }: SavedDetailsCardProps) {
  const lines = [saved.address, saved.city, saved.state].filter((line) => line.trim() !== '');

  return (
    <section
      aria-labelledby="saved-details"
      className="mb-6 rounded-surface border border-border bg-surface p-4"
    >
      <h2
        id="saved-details"
        className="flex items-center gap-2 text-caption-md font-semibold uppercase tracking-wider text-text-secondary"
      >
        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
        Saved for next time
      </h2>

      <div className="mt-2 grid gap-1 text-body-sm text-text-secondary sm:grid-cols-2">
        <p>
          <span className="font-medium text-text-primary">{saved.fullName || 'No name on file'}</span>
          {saved.phone && <> · {saved.phone}</>}
        </p>
        <p className="sm:text-right">
          {lines.length > 0 ? lines.join(', ') : 'No delivery address yet'}
        </p>
      </div>

      <p className="mt-2 text-caption-md text-text-muted">
        Checkout fills these in for you. They come from your most recent order — place
        one with a new address and this follows.
      </p>
    </section>
  );
}
