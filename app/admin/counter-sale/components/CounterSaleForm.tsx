/** ADMIN layer — ringing up a walk-in customer: add items, take payment, print
 *  the receipt, then start the next sale. */
'use client';

import { Banknote } from 'lucide-react';
import { Button } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import OrderEditLineRow from '../../orders/components/OrderEditLineRow';
import AddOrderLine from '../../orders/components/AddOrderLine';
import OrderPrintDocument from '../../orders/components/OrderPrintDocument';
import { useCounterSale, COUNTER_SALE_PRODUCTS_ENDPOINT } from '../hooks/useCounterSale';
import WalkInCustomerFields from './WalkInCustomerFields';
import PaymentMethodPicker from './PaymentMethodPicker';

export default function CounterSaleForm() {
  const sale = useCounterSale();

  if (sale.completed) {
    return (
      <div className="space-y-4 rounded-surface border border-success-border bg-success-background p-6 text-center">
        <p className="text-body-lg font-semibold text-success">Sale recorded — #{sale.completed.order_number}</p>
        <p className="text-body-sm text-text-secondary">
          {formatCurrency(sale.completed.total_amount)} taken. The receipt is printing.
        </p>
        <Button onClick={sale.reset}>New sale</Button>

        <OrderPrintDocument order={sale.completed} kind="invoice" onDone={() => {}} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        {sale.lines.map((line) => (
          <OrderEditLineRow
            key={line.key}
            line={line}
            onChange={sale.updateLine}
            onRemove={sale.removeLine}
          />
        ))}

        {sale.lines.length === 0 && (
          <p className="rounded-surface border border-border bg-background-secondary p-3 text-body-sm text-text-secondary">
            Add the first item to start this sale.
          </p>
        )}
      </div>

      <AddOrderLine onAdd={sale.addLine} productsEndpoint={COUNTER_SALE_PRODUCTS_ENDPOINT} />

      <WalkInCustomerFields
        name={sale.customerName}
        onNameChange={sale.setCustomerName}
        email={sale.customerEmail}
        onEmailChange={sale.setCustomerEmail}
        phone={sale.customerPhone}
        onPhoneChange={sale.setCustomerPhone}
      />

      <div>
        <p className="mb-2 text-body-sm font-medium text-text-primary">Payment</p>
        <PaymentMethodPicker value={sale.paymentMethod} onChange={sale.setPaymentMethod} />
      </div>

      <dl className="rounded-surface border border-border p-3">
        <p className="mb-2 text-caption-md font-medium uppercase tracking-wide text-text-secondary">
          Preview: the server recalculates on submit
        </p>
        {[
          ['Items', sale.preview.subtotal],
          ['Tax', sale.preview.tax],
        ].map(([label, amount]) => (
          <div key={label as string} className="flex justify-between py-0.5 text-body-sm">
            <dt className="text-text-secondary">{label}</dt>
            <dd className="text-text-primary">{formatCurrency(amount as number)}</dd>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-border pt-2">
          <dt className="font-semibold text-text-primary">Total</dt>
          <dd className="text-body-lg font-bold text-text-primary">
            {formatCurrency(sale.preview.total)}
          </dd>
        </div>
      </dl>

      {sale.error && (
        <p role="alert" className="rounded-surface border border-destructive-border bg-destructive-background p-3 text-body-sm text-destructive">
          {sale.error}
        </p>
      )}

      <div className="flex justify-end border-t border-border pt-4">
        <Button
          onClick={sale.submit}
          disabled={sale.lines.length === 0}
          loading={sale.submitting}
        >
          <Banknote className="size-4" aria-hidden="true" />
          Take payment — {formatCurrency(sale.preview.total)}
        </Button>
      </div>
    </div>
  );
}
