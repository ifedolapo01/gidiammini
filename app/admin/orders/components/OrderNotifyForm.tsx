/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/OrderNotifyForm.tsx
//
// The free-text message to one customer about one order. Lifted out of
// OrderDetailsModal when that grew tabs — it was the only part of the modal
// that was a form, and it belongs beside the addresses it sends to.
import { Send, Mail, Phone } from 'lucide-react';
import { Button, Textarea } from '@/components/ui';
import type { Order } from '@/types/order';

interface OrderNotifyFormProps {
  order: Order;
  message: string;
  sending: boolean;
  onMessageChange: (message: string) => void;
  onSend: (orderId: string) => void;
}

export default function OrderNotifyForm({
  order,
  message,
  sending,
  onMessageChange,
  onSend,
}: OrderNotifyFormProps) {
  return (
    <div className="mt-6 border-t border-border pt-6">
      <h3 className="mb-3 font-semibold text-text-primary">Send a message</h3>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="order-notification"
            className="mb-2 block text-body-sm font-medium text-text-primary"
          >
            Message to customer
          </label>
          <Textarea
            id="order-notification"
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            placeholder="Enter your message to the customer..."
            rows={4}
          />
          <p className="mt-1 text-caption-md text-text-secondary">
            Sent by email and SMS, where each is configured.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-2 text-body-sm text-text-secondary">
            <Mail className="size-4" aria-hidden="true" />
            {order.customer_email}
          </span>
          <span className="flex items-center gap-2 text-body-sm text-text-secondary">
            <Phone className="size-4" aria-hidden="true" />
            {order.customer_phone}
          </span>
        </div>

        <Button
          onClick={() => onSend(order.id)}
          disabled={!message.trim()}
          loading={sending}
          className="font-semibold"
        >
          <Send className="size-4" aria-hidden="true" />
          Send notification
        </Button>
      </div>
    </div>
  );
}
