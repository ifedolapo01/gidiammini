/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/hooks/useOrderFilters.ts
'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Order } from '@/types/order';
import type { ShippingZone } from '@/types/shipping';
import { getShippingOverdueInfo } from '@/lib/commerce/shipping-overdue';

export function useOrderFilters(orders: Order[], shippingZones: ShippingZone[] = []) {
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<string>(searchParams?.get('filter') || 'all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOrders = filter === 'all'
    ? orders
    : filter === 'overdue'
    ? orders.filter(order => getShippingOverdueInfo(order, shippingZones) !== null)
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
