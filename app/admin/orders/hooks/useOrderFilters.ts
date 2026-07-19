/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/hooks/useOrderFilters.ts
'use client';

import { useState } from 'react';
import { Order } from '@/types/order';

export function useOrderFilters(orders: Order[]) {
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

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

  return {
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    searchedOrders,
  };
}
