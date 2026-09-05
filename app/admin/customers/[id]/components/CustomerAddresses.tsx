/** ADMIN layer — the addresses parcels for this buyer have actually gone to.
 *
 * Derived from their orders (the customer_addresses view), not stored on the
 * customer. An address book maintained beside the orders it came from is an
 * address book that drifts from them, and what the shop is asking is "where
 * have we sent this person's things", which has exactly one honest source.
 *
 * The count is the useful part: an address used seven times is where they
 * live, and one used once three years ago is not somewhere to send a parcel on
 * a guess.
 */
import { MapPin } from 'lucide-react';
import { formatDate } from '@/lib/commerce/format-date';
import type { CustomerAddress } from '@/types/customer';

function line(address: CustomerAddress): string {
  return [address.delivery_address, address.city, address.selected_lga, address.selected_state]
    .filter(Boolean)
    .join(', ');
}

export default function CustomerAddresses({ addresses }: { addresses: CustomerAddress[] }) {
  if (addresses.length === 0) {
    return (
      <p className="rounded-surface border border-border bg-background-secondary p-4 text-body-sm text-text-secondary">
        No delivery addresses on record — every order so far has been a pickup, or predates
        addresses being captured.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {addresses.map((address, index) => (
        <li
          key={`${address.delivery_address}-${index}`}
          className="flex gap-3 rounded-surface border border-border bg-surface p-3"
        >
          <MapPin className="mt-0.5 size-4 shrink-0 text-text-secondary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="break-words text-body-sm text-text-primary">{line(address)}</p>
            <p className="mt-0.5 text-caption-md text-text-secondary">
              Used {address.times_used ?? 1} time{(address.times_used ?? 1) === 1 ? '' : 's'}
              {address.last_used_at ? ` · last ${formatDate(address.last_used_at)}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
