/** ADMIN layer — the orders list with nothing in it.
 *
 * Two different messages behind one component, and the distinction matters: a
 * shop with no orders at all needs reassurance, while a filtered list with no
 * matches needs to be told there is a filter on. Since the dashboard now links
 * here with a date window attached, the second case is reachable on a shop
 * with hundreds of orders — and "No orders yet" would be flatly untrue.
 */
import { Package } from 'lucide-react';

export default function EmptyOrders({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-surface border border-border bg-surface p-8 text-center shadow-elevation-1 md:p-12">
      <Package className="mx-auto mb-4 size-16 text-text-muted" />
      <h3 className="mb-2 text-h5 font-semibold text-text-primary">
        {filtered ? 'No orders match' : 'No orders yet'}
      </h3>
      <p className="text-text-secondary">
        {filtered
          ? 'Try a different search, or clear the filters above.'
          : 'Orders will appear here when customers place them.'}
      </p>
    </div>
  );
}
