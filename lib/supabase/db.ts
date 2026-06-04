// lib/supabase/db.ts
// This file is for SERVER-ONLY operations (admin, orders)
// DO NOT import this in Client Components

import { createClient } from './server'

// Types
export interface Product {
  id: string
  name: string
  description: string | null
  price: number
  category: string
  main_image: string
  images: string[]
  colors: string[]
  sizes: string[]
  stock: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_email: string
  customer_phone: string
  total_amount: number
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  delivery_option: 'pickup' | 'delivery'
  selected_state: string
  delivery_address: string | null
  city: string | null
  note: string | null
  payment_verified: boolean
  receipt_url: string | null
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string | null
  product_name: string
  price: number
  quantity: number
  size: string | null
  color: string | null
  created_at: string
}

// Admin Product Operations (for admin dashboard only)
export async function createProduct(productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('products')
    .insert([productData])
    .select()
    .single()

  if (error) {
    console.error('Error creating product:', error)
    return null
  }

  return data as Product
}

export async function updateProduct(id: string, updates: Partial<Product>) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('products')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating product:', error)
    return null
  }

  return data as Product
}

export async function deleteProduct(id: string) {
  const supabase = await createClient()
  
  // Soft delete
  const { error } = await supabase
    .from('products')
    .update({ 
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) {
    console.error('Error deleting product:', error)
    return false
  }

  return true
}

// Order Operations
export async function createOrder(orderData: {
  order_number: string
  customer_name: string
  customer_email: string
  customer_phone: string
  total_amount: number
  delivery_option: 'pickup' | 'delivery'
  selected_state: string
  delivery_address?: string
  city?: string
  note?: string
  receipt_url?: string
  items: Array<{
    product_id?: string
    product_name: string
    price: number
    quantity: number
    size?: string
    color?: string
  }>
}) {
  const supabase = await createClient()

  // 1. Atomically check and decrease stock for all items
  const itemsToDecrement = orderData.items
    .filter(item => item.product_id)
    .map(item => ({
      product_id: item.product_id,
      quantity: item.quantity
    }))

  if (itemsToDecrement.length > 0) {
    const { data: success, error: rpcError } = await supabase.rpc('check_and_decrease_stock_multi', {
      items: itemsToDecrement
    })

    if (rpcError || !success) {
      throw new Error(`Insufficient stock for one or more items. Please verify product inventory.`)
    }
  }

  try {
    // 2. Insert the main order record
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        order_number: orderData.order_number,
        customer_name: orderData.customer_name,
        customer_email: orderData.customer_email,
        customer_phone: orderData.customer_phone,
        total_amount: orderData.total_amount,
        delivery_option: orderData.delivery_option,
        selected_state: orderData.selected_state,
        delivery_address: orderData.delivery_address,
        city: orderData.city,
        note: orderData.note,
        receipt_url: orderData.receipt_url,
        status: 'pending' 
      }])
      .select()
      .single()

    if (orderError) {
      throw orderError
    }

    // 3. Create order items
    const orderItems = orderData.items.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      price: item.price,
      quantity: item.quantity,
      size: item.size,
      color: item.color
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      // Clean up the order if items fail
      await supabase.from('orders').delete().eq('id', order.id)
      throw itemsError
    }

    return order as Order

  } catch (error: any) {
    console.error('Error creating order, rolling back stock changes:', error)
    
    // Rollback: restore stock
    if (itemsToDecrement.length > 0) {
      for (const item of itemsToDecrement) {
        await supabase.rpc('increase_product_stock', {
          product_id: item.product_id,
          quantity: item.quantity
        })
      }
    }
    
    throw error
  }
}

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

// Admin Operations
export async function verifyAdmin(email: string, password: string) {
  // Simple admin check - in production use Supabase Auth
  if (email === process.env.ADMIN_EMAIL && 
      password === process.env.ADMIN_PASSWORD) {
    return { success: true }
  }
  return { success: false, error: 'Invalid credentials' }
}