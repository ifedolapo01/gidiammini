// app/admin/orders/components/OrderDetailsModal.tsx
import { RefreshCw, Send, Mail, Phone } from 'lucide-react';
import { Order } from '@/types/product';

interface OrderDetailsModalProps {
  selectedOrder: Order;
  notificationMessage: string;
  sendingNotification: string | null;
  onClose: () => void;
  onNotificationMessageChange: (message: string) => void;
  onSendNotification: (orderId: string) => void;
  getStatusColor: (status: Order['status']) => string;
}

export default function OrderDetailsModal({
  selectedOrder,
  notificationMessage,
  sendingNotification,
  onClose,
  onNotificationMessageChange,
  onSendNotification,
  getStatusColor,
}: OrderDetailsModalProps) {
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onMouseDown={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Order {selectedOrder.order_number}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {/* Customer Info */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">Customer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-medium text-black">{selectedOrder.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium text-black">{selectedOrder.customer_email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="font-medium text-black">{selectedOrder.customer_phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>
                  {selectedOrder.status}
                </span>
              </div>
            </div>
          </div>

          {/* Order Items */}
          {selectedOrder.order_items && selectedOrder.order_items.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-3">Order Items</h3>
              <div className="space-y-2">
                {selectedOrder.order_items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-black">{item.product_name}</p>
                      <p className="text-sm text-gray-600">
                        Quantity: {item.quantity}
                        {item.size && ` • Size/Age: ${item.size}`}
                        {item.color && ` • Color: ${item.color}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">₦{item.price.toLocaleString()} each</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delivery Info */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">Delivery Information</h3>
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="font-medium text-blue-600">
                {selectedOrder.delivery_option === 'pickup' ? 'Pickup' : 'Delivery'}
              </p>
              <p className="text-sm text-gray-600">State: {selectedOrder.selected_state}</p>
              {selectedOrder.delivery_address && (
                <p className="text-sm text-gray-600 mt-1">
                  Address: {selectedOrder.delivery_address}, {selectedOrder.city}
                </p>
              )}
              {selectedOrder.note && (
                <div className="mt-2 p-2 bg-yellow-50 rounded">
                  <p className="text-sm text-gray-700 font-medium">Customer Note:</p>
                  <p className="text-sm text-gray-600">{selectedOrder.note}</p>
                </div>
              )}
            </div>
          </div>

          {/* Send Notification Form */}
          <div className="mt-6 pt-6 border-t">
            <h3 className="font-semibold text-gray-700 mb-3">Send Notification</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message to Customer
                </label>
                <textarea
                  value={notificationMessage}
                  onChange={(e) => onNotificationMessageChange(e.target.value)}
                  placeholder="Enter your message to the customer..."
                  className="w-full border border-gray-300 rounded-lg text-black px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This message will be sent via email and SMS (if available)
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">{selectedOrder.customer_email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">{selectedOrder.customer_phone}</span>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => onSendNotification(selectedOrder.id)}
                  disabled={!notificationMessage.trim() || sendingNotification === selectedOrder.id}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {sendingNotification === selectedOrder.id ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Notification
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 border border-gray-500 rounded-lg text-black font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}