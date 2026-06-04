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
        note: orderData.note
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

    return order

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