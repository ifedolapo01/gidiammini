/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/OrderDetailsModal.tsx
//
// The order panel, now a shell over four tabs.
//
// It used to be one scroll: customer, history, items, delivery, shipping
// override, change request, notify. Adding an editor and a refund ledger to
// that would have made a panel nobody could find anything in — and, worse, put
// a destructive control (remove line) directly under a read-only one (view
// items) in a single column.
//
// Tabs rather than an accordion because the four sections answer four
// different questions and an operator arrives knowing which one they have:
// "what is this order", "change it", "what money went back", "who touched it".
'use client';

import { useState } from 'react';
import { FileText, Printer } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import type { Order } from '@/types/order';
import type { ShippingZone } from '@/types/shipping';
import { cn } from '@/lib/utils';
import EntityHistory from '@/app/admin/components/EntityHistory';
import OrderStatusHistory from './OrderStatusHistory';
import OrderSummaryTab from './OrderSummaryTab';
import OrderEditPanel from './OrderEditPanel';
import RefundPanel from './RefundPanel';
import OrderPrintDocument, { type PrintDocumentKind } from './OrderPrintDocument';

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'edit', label: 'Edit items' },
  { id: 'refunds', label: 'Refunds' },
  { id: 'history', label: 'History' },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface OrderDetailsModalProps {
  selectedOrder: Order;
  notificationMessage: string;
  sendingNotification: string | null;
  shippingZones: ShippingZone[];
  updatingShipping: boolean;
  resolvingRequestId: string | null;
  showToast: (message: string, type?: 'success' | 'error') => void;
  onClose: () => void;
  /** Re-read this order and the list behind it, after a mutation made here. */
  onRefresh: () => Promise<void> | void;
  onNotificationMessageChange: (message: string) => void;
  onSendNotification: (orderId: string) => void;
  onUpdateShipping: (orderId: string, shippingZoneId: string, deliveryOption: 'pickup' | 'delivery') => void;
  onResolveChangeRequest: (requestId: string, decision: 'approved' | 'rejected', adminResponse?: string) => void;
}

export default function OrderDetailsModal(props: OrderDetailsModalProps) {
  const { selectedOrder, showToast, onClose, onRefresh } = props;
  const [tab, setTab] = useState<TabId>('summary');
  const [printing, setPrinting] = useState<PrintDocumentKind | null>(null);

  // A refund count on the tab would need the refunds loaded to show it, which
  // would defeat loading them on demand. The refunded total is already on the
  // order, so the dot uses that instead.
  const hasRefunds = Number(selectedOrder.amount_refunded ?? 0) > 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Order ${selectedOrder.order_number}`}
      size="xl"
      scrollable
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <Button size="sm" variant="outline" onClick={() => setPrinting('packing-slip')}>
          <Printer className="size-4" aria-hidden="true" />
          Packing slip
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPrinting('invoice')}>
          <FileText className="size-4" aria-hidden="true" />
          Invoice
        </Button>
      </div>

      <div role="tablist" aria-label="Order sections" className="mb-5 flex flex-wrap gap-1">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
            className={cn(
              'rounded-control px-3 py-2 text-body-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
              tab === entry.id
                ? 'bg-primary text-primary-foreground'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            )}
          >
            {entry.label}
            {entry.id === 'refunds' && hasRefunds && (
              <span
                aria-hidden="true"
                className="ml-1.5 inline-block size-1.5 rounded-full bg-current align-middle"
              />
            )}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <OrderSummaryTab
          order={selectedOrder}
          shippingZones={props.shippingZones}
          updatingShipping={props.updatingShipping}
          resolvingRequestId={props.resolvingRequestId}
          notificationMessage={props.notificationMessage}
          sendingNotification={props.sendingNotification}
          showToast={showToast}
          onRefresh={onRefresh}
          onNotificationMessageChange={props.onNotificationMessageChange}
          onSendNotification={props.onSendNotification}
          onUpdateShipping={props.onUpdateShipping}
          onResolveChangeRequest={props.onResolveChangeRequest}
        />
      )}

      {tab === 'edit' && (
        <OrderEditPanel order={selectedOrder} showToast={showToast} onSaved={onRefresh} />
      )}

      {tab === 'refunds' && (
        <RefundPanel orderId={selectedOrder.id} showToast={showToast} onChanged={onRefresh} />
      )}

      {tab === 'history' && (
        <>
          <OrderStatusHistory entries={selectedOrder.order_status_history ?? []} />
          {/* Who changed what, and why — the question order_status_history
              cannot answer, since it records only a status and a timestamp. */}
          <EntityHistory entityType="order" entityId={selectedOrder.id} pageSize={10} />
        </>
      )}

      {printing && (
        <OrderPrintDocument
          order={selectedOrder}
          kind={printing}
          onDone={() => setPrinting(null)}
        />
      )}
    </Modal>
  );
}
