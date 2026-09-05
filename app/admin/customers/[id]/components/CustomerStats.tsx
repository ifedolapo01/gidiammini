/** ADMIN layer — the four figures that decide how this buyer is treated.
 *
 * Gross spend and net spend sit side by side deliberately. One customer with
 * ₦400,000 of orders who has sent ₦180,000 of it back is not the same as one
 * with ₦400,000 who has sent nothing back, and a single "lifetime value"
 * column cannot say so — which is exactly how a returns problem hides inside a
 * best-customers list.
 */
import { formatCurrency } from '@/lib/commerce/pricing';
import { formatDate } from '@/lib/commerce/format-date';
import type { CustomerDetail } from '@/types/customer';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-surface border border-border bg-surface p-4">
      <p className="text-caption-md uppercase tracking-wider text-text-secondary">{label}</p>
      <p className="mt-1 text-h5 font-bold text-text-primary">{value}</p>
      {hint && <p className="mt-0.5 text-caption-md text-text-secondary">{hint}</p>}
    </div>
  );
}

export default function CustomerStats({ customer }: { customer: CustomerDetail }) {
  const total = customer.orders_total ?? 0;
  const cancelled = customer.orders_cancelled ?? 0;
  const refunded = Number(customer.lifetime_refunded ?? 0);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        label="Orders"
        value={String(total)}
        hint={cancelled > 0 ? `${cancelled} cancelled` : 'None cancelled'}
      />
      <Stat
        label="Lifetime spend"
        value={formatCurrency(Number(customer.lifetime_value ?? 0))}
        hint="Everything they agreed to pay"
      />
      <Stat
        label="Kept"
        value={formatCurrency(Number(customer.net_lifetime_value ?? 0))}
        hint={refunded > 0 ? `${formatCurrency(refunded)} refunded` : 'Nothing refunded'}
      />
      <Stat
        label="Last seen"
        value={customer.last_order_at ? formatDate(customer.last_order_at) : '—'}
        hint={
          customer.first_order_at
            ? `First ordered ${formatDate(customer.first_order_at)}`
            : 'Has never ordered'
        }
      />
    </div>
  );
}
