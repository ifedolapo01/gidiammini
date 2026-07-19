/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/OrderDetailsModal.tsx
import { Send, Mail, Phone } from 'lucide-react';
import { Button, Modal, Textarea } from '@/components/ui';
import { Order } from '@/types/order';
import { formatCurrency } from '@/lib/commerce/pricing';
import { getStatusColor } from '@/lib/commerce/order-status';

interface OrderDetailsModalProps {
  selectedOrder: Order;
  notificationMessage: string;
  sendingNotification: string | null;
  onClose: () => void;
  onNotificationMessageChange: (message: string) => void;
  onSendNotification: (orderId: string) => void;
}

export default function OrderDetailsModal({
  selectedOrder,
  notificationMessage,
  sendingNotification,
  onClose,
  onNotificationMessageChange,
  onSendNotification,
}: OrderDetailsModalProps) {
  return (
    <Modal
      open
      onClose={onClose}
      title={`Order ${selectedOrder.order_number}`}
      size="lg"
      className="max-h-[90vh] overflow-y-auto"
    >
      {/* Customer Info */}
      <div className="mb-6">
        <h3 className="font-semibold text-text-primary mb-3">Customer Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-body-sm text-text-secondary">Name</p>
            <p className="font-medium text-text-primary">{selectedOrder.customer_name}</p>
          </div>
          <div>
            <p className="text-body-sm text-text-secondary">Email</p>
            <p className="font-medium text-text-primary">{selectedOrder.customer_email}</p>
          </div>
          <div>
            <p className="text-body-sm text-text-secondary">Phone</p>
            <p className="font-medium text-text-primary">{selectedOrder.customer_phone}</p>
          </div>
          <div>
            <p className="text-body-sm text-text-secondary">Status</p>
            <span className={`px-2 py-1 rounded-control text-caption-md font-medium ${getStatusColor(selectedOrder.status)}`}>
              {selectedOrder.status}
            </span>
          </div>
        </div>
      </div>

      {/* Order Items */}
      {selectedOrder.order_items && selectedOrder.order_items.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-text-primary mb-3">Order Items</h3>
          <div className="space-y-2">
            {selectedOrder.order_items.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-background-secondary rounded-surface">
                <div>
                  <p className="font-medium text-text-primary">{item.product_name}</p>
                  <p className="text-body-sm text-text-secondary">
                    Quantity: {item.quantity}
                    {item.size && ` • Size/Age: ${item.size}`}
                    {item.color && ` • Color: ${item.color}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-body-sm text-text-secondary">{formatCurrency(item.price)} each</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delivery Info */}
      <div className="mb-6">
        <h3 className="font-semibold text-text-primary mb-3">Delivery Information</h3>
        <div className="p-3 bg-info-background rounded-surface">
          <p className="font-medium text-info">
            {selectedOrder.delivery_option === 'pickup' ? 'Pickup' : 'Delivery'}
          </p>
          <p className="text-body-sm text-text-secondary">State: {selectedOrder.selected_state}</p>
          {selectedOrder.delivery_address && (
            <p className="text-body-sm text-text-secondary mt-1">
              Address: {selectedOrder.delivery_address}, {selectedOrder.city}
            </p>
          )}
          {selectedOrder.note && (
            <div className="mt-2 p-2 bg-warning-background rounded-control">
              <p className="text-body-sm text-text-primary font-medium">Customer Note:</p>
              <p className="text-body-sm text-text-secondary">{selectedOrder.note}</p>
            </div>
          )}
        </div>
      </div>

      {/* Send Notification Form */}
      <div className="mt-6 pt-6 border-t border-border">
        <h3 className="font-semibold text-text-primary mb-3">Send Notification</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-body-sm font-medium text-text-primary mb-2">
              Message to Customer
            </label>
            <Textarea
              value={notificationMessage}
              onChange={(e) => onNotificationMessageChange(e.target.value)}
              placeholder="Enter your message to the customer..."
              rows={4}
            />
            <p className="text-caption-md text-text-secondary mt-1">
              This message will be sent via email and SMS (if available)
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-text-secondary" />
              <span className="text-body-sm text-text-secondary">{selectedOrder.customer_email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-text-secondary" />
              <span className="text-body-sm text-text-secondary">{selectedOrder.customer_phone}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => onSendNotification(selectedOrder.id)}
              disabled={!notificationMessage.trim()}
              loading={sendingNotification === selectedOrder.id}
              className="flex-1 font-semibold"
            >
              <Send className="w-4 h-4" />
              Send Notification
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="font-semibold"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
