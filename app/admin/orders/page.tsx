// app/admin/orders/page.tsx - UPDATED
'use client';

import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Package, 
  Truck, 
  Home, 
  RefreshCw, 
  Search, 
  Filter, 
  Eye,
  Send
} from 'lucide-react';
import OrderDetailsModal from './components/OrderDetailsModal';
import { Order, OrderItem } from '@/types/product';

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [sendingNotification, setSendingNotification] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string>('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/orders');
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      } else {
        console.error('Failed to fetch orders');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshOrders = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      // Show confirmation for certain status changes
      if (newStatus === 'cancelled') {
        if (!confirm('Are you sure you want to cancel this order? This action cannot be undone.')) {
          return;
        }
      }

      console.log(`Updating order ${orderId} to status: ${newStatus}`);
      console.log(`Calling API: /api/orders/${orderId}`);
      
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          status: newStatus,
          sendNotification: true,
          notificationMessage: `Your order status has been updated to: ${newStatus.toUpperCase()}`
          // payment_verified will be handled automatically by the API
        }),
      });

      console.log('Response status:', response.status);
      
      const result = await response.json();
      console.log('Update response:', result);
      
      if (response.ok && result.success) {
        // Update local state immediately for better UX
        setOrders(prevOrders =>
          prevOrders.map(order =>
            order.id === orderId
              ? {
                  ...order,
                  status: newStatus,
                  // Update payment status if it was auto-verified
                  payment_verified: result.paymentVerified || order.payment_verified
                }
              : order
          )
        );
        
        // Show success message
        const message = result.paymentVerified 
          ? `✅ Order confirmed! Payment marked as verified. Customer has been notified.`
          : `✅ Order status updated to ${newStatus}. Customer has been notified.`;
        
        alert(message);
      } else {
        console.error('Update failed:', result);
        alert(`❌ Failed to update order status: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error updating order:', error);
      alert(`❌ Error updating order: ${error.message || 'Please check your connection.'}`);
    }
  };

  const sendCustomNotification = async (orderId: string) => {
    if (!notificationMessage.trim()) {
      alert('Please enter a message');
      return;
    }

    try {
      setSendingNotification(orderId);
      const response = await fetch(`/api/orders/${orderId}/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: notificationMessage,
          viaEmail: true,
          viaSMS: true
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          alert('Notification sent successfully!');
          setNotificationMessage('');
          setSelectedOrder(null);
        } else {
          alert(`Failed to send notification: ${result.error}`);
        }
      } else {
        alert('Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      alert('Error sending notification');
    } finally {
      setSendingNotification(null);
    }
  };

  const filteredOrders = filter === 'all' 
    ? orders 
    : orders.filter(order => order.status === filter);

  // Apply search filter
  const searchedOrders = searchTerm
    ? filteredOrders.filter(order =>
        order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_phone?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : filteredOrders;

  const getStatusIcon = (status: Order['status']) => {
    switch(status) {
      case 'pending': return <Package className="text-yellow-500" />;
      case 'confirmed': return <CheckCircle className="text-blue-500" />;
      case 'shipped': return <Truck className="text-purple-500" />;
      case 'delivered': return <Home className="text-green-500" />;
      case 'cancelled': return <XCircle className="text-red-500" />;
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch(status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'shipped': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusOptions = (currentStatus: Order['status']) => {
    const allStatuses: Order['status'][] = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    
    // If current status is delivered or cancelled, can't change to other statuses
    if (currentStatus === 'delivered' || currentStatus === 'cancelled') {
      return [currentStatus];
    }
    
    return allStatuses;
  };

  const calculateSubtotal = (items: OrderItem[] = []) => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const openOrderDetails = (order: Order) => {
    setSelectedOrder(order);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <div className="text-lg text-gray-600">Loading orders...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 md:p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Manage Orders</h1>
            <p className="text-gray-600 mt-1">
              {searchedOrders.length} order{searchedOrders.length !== 1 ? 's' : ''} found
            </p>
          </div>
          
          <div className="flex items-center gap-3 mt-4 md:mt-0">
            <button
              onClick={refreshOrders}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-black ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by order number, customer name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {['all', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-2 rounded-lg capitalize whitespace-nowrap flex items-center gap-2 ${
                    filter === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {status === 'all' ? (
                    <>
                      <Filter className="w-4 h-4" />
                      All Orders
                    </>
                  ) : (
                    <>
                      {getStatusIcon(status as any)}
                      {status}
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Orders List */}
        {searchedOrders.length === 0 ? (
          <div className="bg-white rounded-xl shadow border p-8 md:p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              {searchTerm ? 'No orders found' : 'No orders yet'}
            </h3>
            <p className="text-gray-500">
              {searchTerm 
                ? 'Try a different search term' 
                : 'Orders will appear here when customers place them'
              }
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:gap-6">
            {searchedOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl shadow border overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between mb-4 md:mb-6">
                    <div className="flex-1 mb-4 md:mb-0">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {getStatusIcon(order.status)}
                        <span className="font-bold text-lg text-gray-900">{order.order_number}</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          order.payment_verified 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {order.payment_verified ? 'Paid' : 'Unpaid'}
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="font-medium text-gray-900">
                          {order.customer_name}
                        </p>
                        <p className="text-gray-600 text-sm">
                          {order.customer_email}
                        </p>
                        <p className="text-gray-600 text-sm">
                          📞 {order.customer_phone}
                        </p>
                      </div>
                      
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs ${
                          order.delivery_option === 'pickup' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {order.delivery_option === 'pickup' ? 'Pickup' : 'Delivery'} • {order.selected_state}
                        </span>
                        {order.receipt_url && (
                          <a
                            href={order.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs hover:bg-green-200"
                          >
                            View Receipt
                          </a>
                        )}
                        {order.note && (
                          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                            Has Note
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-bold text-2xl text-gray-900">
                        ₦{order.total_amount.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {formatDate(order.created_at)}
                      </p>
                      {order.delivery_option === 'delivery' && order.delivery_address && (
                        <p className="text-sm text-gray-600 mt-2 max-w-xs">
                          📍 {order.delivery_address}, {order.city}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Order Items Preview */}
                  {order.order_items && order.order_items.length > 0 && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <p className="font-medium text-gray-700 text-sm mb-2">Order Items:</p>
                      <div className="space-y-1">
                        {order.order_items.slice(0, 2).map((item, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span className="text-gray-600">
                              {item.product_name} × {item.quantity}
                              {item.size && ` (${item.size})`}
                              {item.color && ` • ${item.color}`}
                            </span>
                            <span className="font-medium text-blue-600">
                              ₦{(item.price * item.quantity).toLocaleString()}
                            </span>
                          </div>
                        ))}
                        {order.order_items.length > 2 && (
                          <p className="text-gray-500 text-xs mt-1">
                            +{order.order_items.length - 2} more items
                            (₦{calculateSubtotal(order.order_items.slice(2)).toLocaleString()})
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t">
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-gray-600">
                        Order ID: <span className="font-mono text-gray-800">{order.id.slice(0, 8)}...</span>
                      </p>
                      <button
                        onClick={() => openOrderDetails(order)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Details
                      </button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value as Order['status'])}
                        className="border rounded-lg px-3 py-2 text-sm text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {getStatusOptions(order.status).map((status) => (
                          <option key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => openOrderDetails(order)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                      >
                        <Send className="w-4 h-4" />
                        Notify
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow border">
            <p className="text-sm text-gray-600">Total Orders</p>
            <p className="text-2xl font-bold text-gray-800">{orders.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <p className="text-sm text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">
              {orders.filter(o => o.status === 'pending').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
  <p className="text-sm text-gray-600">Total Revenue</p>
  <p className="text-2xl font-bold text-green-600">
    ₦{orders
      .filter(order => order.status !== 'cancelled')
      .reduce((sum, order) => sum + order.total_amount, 0)
      .toLocaleString()
    }
  </p>
  <p className="text-xs text-gray-500 mt-1">Excluding cancelled orders</p>
</div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <p className="text-sm text-gray-600">Paid Orders</p>
            <p className="text-2xl font-bold text-blue-600">
              {orders.filter(o => o.payment_verified).length}
            </p>
          </div>
        </div>
      </div>

      {/* Order Details & Notification Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          selectedOrder={selectedOrder}
          notificationMessage={notificationMessage}
          sendingNotification={sendingNotification}
          onClose={() => setSelectedOrder(null)}
          onNotificationMessageChange={setNotificationMessage}
          onSendNotification={sendCustomNotification}
          getStatusColor={getStatusColor}
        />
      )}
    </>
  );
}