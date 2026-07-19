// lib/supabase/products.ts
// This file is for SERVER-ONLY product operations (admin dashboard).
// DO NOT import this in Client Components

import { createClient } from './server'
import type { Product } from '@/types/product'

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
