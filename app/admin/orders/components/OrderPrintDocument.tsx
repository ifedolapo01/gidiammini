/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/OrderPrintDocument.tsx
//
// The two pieces of paper an order needs: a pick list for whoever packs it,
// and an invoice for the box.
//
// ONE COMPONENT, TWO DOCUMENTS
//
// They share the header, the addresses and the line table, and differ in
// exactly two ways: the packing slip shows quantities and hides money, because
// a packer does not need prices and a picking error is a quantity error; the
// invoice shows money and hides the tick boxes. Two components would be one
// component and a copy of it that drifts.
//
// DELIBERATELY NOT TOKENISED
//
// Every other component in this admin uses semantic tokens. This one uses
// black on white, because paper has one theme and a token that resolves to a
// dark background in the operator's browser would print as a black rectangle.
'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import type { Order } from '@/types/order';
import { formatCurrency } from '@/lib/commerce/pricing';
import { formatDate } from '@/lib/commerce/format-date';
import { carrierName } from '@/lib/commerce/order-tracking';
import { SHOP_CONTACT } from '@/lib/notifications/templates/email-shell';
import InvoiceTotals from './InvoiceTotals';

export type PrintDocumentKind = 'packing-slip' | 'invoice';

interface OrderPrintDocumentProps {
  order: Order;
  kind: PrintDocumentKind;
  /** Called once the print dialog has been dismissed, so the caller can drop
   * the document from the tree. */
  onDone: () => void;
}

const CELL = 'border border-black/30 px-2 py-1.5 text-left align-top';

function Address({ order }: { order: Order }) {
  return (
    <div>
      <p className="text-[10pt] uppercase tracking-wide text-black/60">
        {order.delivery_option === 'pickup' ? 'Collecting' : 'Deliver to'}
      </p>
      <p className="font-semibold">{order.customer_name}</p>
      {order.delivery_option === 'delivery' && order.delivery_address && (
        <p>{order.delivery_address}{order.city ? `, ${order.city}` : ''}</p>
      )}
      <p>
        {[order.selected_place, order.selected_lga, order.selected_state].filter(Boolean).join(', ')}
      </p>
      <p>{order.customer_phone}</p>
      <p>{order.customer_email}</p>
    </div>
  );
}

export default function OrderPrintDocument({ order, kind, onDone }: OrderPrintDocumentProps) {
  const [mounted, setMounted] = useState(false);
  const invoice = kind === 'invoice';

  useEffect(() => setMounted(true), []);

  // Printed on the next frame, once the portal's content is actually in the
  // document — window.print() on the same tick prints the page without it.
  useEffect(() => {
    if (!mounted) return;

    const frame = requestAnimationFrame(() => {
      window.print();
      onDone();
    });

    return () => cancelAnimationFrame(frame);
  }, [mounted, onDone]);

  if (!mounted) return null;

  const items = order.order_items ?? [];

  return createPortal(
    <div data-print-root className="bg-white p-0 text-[11pt] leading-snug text-black">
      <header className="mb-6 flex items-start justify-between gap-8 border-b-2 border-black pb-3">
        <div>
          <p className="text-[16pt] font-bold">{SHOP_CONTACT.name}</p>
          <p className="text-[10pt] text-black/70">{SHOP_CONTACT.address}</p>
          <p className="text-[10pt] text-black/70">
            {SHOP_CONTACT.phone} · {SHOP_CONTACT.email}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[14pt] font-bold uppercase tracking-wide">
            {invoice ? 'Invoice' : 'Packing slip'}
          </p>
          <p className="font-mono text-[12pt]">#{order.order_number}</p>
          <p className="text-[10pt] text-black/70">{formatDate(order.created_at)}</p>
        </div>
      </header>

      <section className="mb-5 grid grid-cols-2 gap-8">
        <Address order={order} />
        <div className="text-[10pt]">
          <p className="uppercase tracking-wide text-black/60">Fulfilment</p>
          <p className="font-semibold">
            {order.delivery_option === 'pickup' ? 'Store pickup' : 'Delivery'}
          </p>
          {order.carrier && <p>Courier: {carrierName(order.carrier)}</p>}
          {order.tracking_number && <p className="font-mono">Waybill: {order.tracking_number}</p>}
          {order.note && (
            <p className="mt-2">
              <span className="uppercase tracking-wide text-black/60">Customer note</span>
              <br />
              {order.note}
            </p>
          )}
        </div>
      </section>

      <table className="w-full border-collapse text-[10.5pt]">
        <thead>
          <tr className="bg-black/5">
            {!invoice && <th className={`${CELL} w-8`} scope="col">✓</th>}
            <th className={CELL} scope="col">Item</th>
            <th className={CELL} scope="col">Variant</th>
            <th className={`${CELL} w-16 text-right`} scope="col">Qty</th>
            {invoice && <th className={`${CELL} w-28 text-right`} scope="col">Unit</th>}
            {invoice && <th className={`${CELL} w-28 text-right`} scope="col">Amount</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id ?? index}>
              {/* An empty box a packer ticks. The single most useful thing on a
                  pick list, and the reason this is paper and not a screen. */}
              {!invoice && <td className={CELL}>&nbsp;</td>}
              <td className={CELL}>{item.product_name}</td>
              <td className={CELL}>{[item.size, item.color].filter(Boolean).join(' / ') || '—'}</td>
              <td className={`${CELL} text-right font-semibold`}>{item.quantity}</td>
              {invoice && <td className={`${CELL} text-right`}>{formatCurrency(item.price)}</td>}
              {invoice && (
                <td className={`${CELL} text-right`}>{formatCurrency(item.price * item.quantity)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {invoice && (
        <section className="mt-4 flex justify-end print-keep-together">
          <InvoiceTotals order={order} />
        </section>
      )}

      {!invoice && (
        <section className="mt-6 print-keep-together">
          <p className="text-[10pt] uppercase tracking-wide text-black/60">Packed by</p>
          <div className="mt-6 flex gap-12">
            <span className="w-56 border-b border-black/50">&nbsp;</span>
            <span className="w-40 border-b border-black/50">&nbsp;</span>
          </div>
          <div className="mt-1 flex gap-12 text-[9pt] text-black/60">
            <span className="w-56">Name</span>
            <span className="w-40">Date</span>
          </div>
        </section>
      )}

      <footer className="mt-8 border-t border-black/30 pt-2 text-[9pt] text-black/60">
        {invoice
          ? `Thank you for shopping with ${SHOP_CONTACT.name}. Questions about this invoice: ${SHOP_CONTACT.email}`
          : `Check every line against the box before sealing it. Order #${order.order_number}.`}
      </footer>
    </div>,
    document.body
  );
}
