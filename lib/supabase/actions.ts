// lib/supabase/actions.ts
'use server'

import { createClient } from './server'
import { Product, OrderData } from '@/types/product'

export async function getProducts(category?: string) {
  const supabase = await createClient()
  
  let query = supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (category && category !== 'all') {
    query = query.eq('category', category)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching products:', error)
    return []
  }

  return data as Product[]
}

export async function getProduct(id: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('Error fetching product:', error)
    return null
  }

  return data as Product
}

export async function createOrder(orderData: OrderData) {
  const supabase = await createClient()

  // First, check stock availability before creating order
  for (const item of orderData.items) {
    if (item.product_id) {
      const { data: product } = await supabase
        .from('products')
        .select('stock')
        .eq('id', item.product_id)
        .single()
      
      if (product && product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${item.product_name}. Available: ${product.stock}, Requested: ${item.quantity}`)
      }
    }
  }

  // Start a transaction
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
      note: orderData.note
    }])
    .select()
    .single()

  if (orderError) {
    console.error('Error creating order:', orderError)
    return null
  }

  // Create order items
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
    console.error('Error creating order items:', itemsError)
    // Clean up the order if items fail
    await supabase.from('orders').delete().eq('id', order.id)
    return null
  }

  // Update product stock
  for (const item of orderData.items) {
    if (item.product_id) {
      await supabase.rpc('decrease_product_stock', {
        product_id: item.product_id,
        quantity: item.quantity
      })
    }
  }

  return order
}