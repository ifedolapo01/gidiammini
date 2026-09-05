/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/OrderMoneySummary.tsx
//
// What the order costs, what has been received, and what that leaves. Until
// the breakdown existed this panel could only say "Total: 24,500", which is
// the one number that never answers the question actually being asked —
// "does this person still owe me anything".
import { formatCurrency } from '@/lib/commerce/pricing';
import { orderChargeLines, orderSettlement, type OrderMoney } from '@/lib/commerce/order-money';

export default function OrderMoneySummary({ order }: { order: OrderMoney }) {
  const lines = orderChargeLines(order);
  const settlement = orderSettlement(order);

  return (
    <div className="mb-6">
      <h3 className="mb-3 font-semibold text-text-primary">Money</h3>

      <dl className="rounded-surface border border-border bg-background-secondary p-3">
        {lines.map((line) => (
          <div
            key={line.label}
            className={
              line.kind === 'total'
                ? 'mt-2 flex items-baseline justify-between gap-4 border-t border-border pt-2'
                : 'flex items-baseline justify-between gap-4 py-1'
            }
          >
            <dt
              className={
                line.kind === 'total'
                  ? 'font-semibold text-text-primary'
                  : 'text-body-sm text-text-secondary'
              }
            >
              {line.label}
            </dt>
            <dd
              className={
                line.kind === 'total'
                  ? 'text-body-lg font-bold text-text-primary'
                  : line.kind === 'credit'
                    ? 'text-body-sm font-medium text-success'
                    : 'text-body-sm font-medium text-text-primary'
              }
            >
              {line.amount < 0 ? `-${formatCurrency(Math.abs(line.amount))}` : formatCurrency(line.amount)}
            </dd>
          </div>
        ))}

        {/* Settlement is separated from the charge lines on purpose: what the
            order costs and what has been received are different facts, and
            running them into one column is how a part payment gets read as a
            discount. */}
        {settlement.paid > 0 && (
          <div className="mt-3 space-y-1 border-t border-border pt-3">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-body-sm text-text-secondary">Received</dt>
              <dd className="text-body-sm font-medium text-text-primary">
                {formatCurrency(settlement.paid)}
              </dd>
            </div>

            {settlement.refunded > 0 && (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-body-sm text-text-secondary">Refunded</dt>
                <dd className="text-body-sm font-medium text-warning">
                  -{formatCurrency(settlement.refunded)}
                </dd>
              </div>
            )}

            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-body-sm font-medium text-text-primary">
                {settlement.overpaid ? 'Owed back' : settlement.balance > 0 ? 'Outstanding' : 'Balance'}
              </dt>
              <dd
                className={`text-body-md font-bold ${
                  settlement.balance > 0
                    ? 'text-warning'
                    : settlement.overpaid
                      ? 'text-destructive'
                      : 'text-success'
                }`}
              >
                {formatCurrency(Math.abs(settlement.balance))}
              </dd>
            </div>
          </div>
        )}
      </dl>
    </div>
  );
}
