// lib/supabase/orders.ts
// This file is for SERVER-ONLY order operations (admin, orders)
// DO NOT import this in Client Components

import { createClient } from './server'
import type { Order, OrderItem } from '@/types/order'

// NOTE: a dead `createOrder` used to live here, duplicating the one in
// actions.ts. Both called the now-dropped check_and_decrease_stock_multi /
// increase_product_stock RPCs. See scripts/fix-stock-trigger-conflict.sql;
// lib/commerce/create-order.ts is the single order-creation path.

export async function getOrders(status?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('orders')
    .select(`
      *,
      order_items (*)
    `)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching orders:', error)
    return []
  }

  return data as (Order & { order_items: OrderItem[] })[]
}

export async function updateOrderStatus(id: string, status: Order['status']) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating order:', error)
    return null
  }

  return data as Order
}
