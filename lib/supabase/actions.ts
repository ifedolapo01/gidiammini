// lib/supabase/actions.ts
'use server'

import { createClient } from './server'
import { Product } from '@/types/product'
import { PUBLIC_VARIANTS_SELECT } from '@/lib/commerce/product-variants'

export async function getProducts(category?: string) {
  const supabase = await createClient()
  
  // Anon key: the variant columns are named, because `product_variants(*)`
  // would be refused (no grant on cost).
  let query = supabase
    .from('products')
    .select(`*,${PUBLIC_VARIANTS_SELECT}`)
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
    .select(`*,${PUBLIC_VARIANTS_SELECT}`)
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('Error fetching product:', error)
    return null
  }

  return data as Product
}

// NOTE: a dead `createOrder` used to live here. It called the
// check_and_decrease_stock_multi / increase_product_stock RPCs, both of which
// were unreferenced and broken (they compared products.id (uuid) against a text
// value) and have now been dropped — see scripts/fix-stock-trigger-conflict.sql.
// Order creation goes through lib/commerce/create-order.ts, which claims stock
// atomically via adjust_order_stock(). Removed rather than left as a plausible-
// looking alternative that would fail on first use.
