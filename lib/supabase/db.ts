// lib/supabase/db.ts
// This file is for SERVER-ONLY operations (admin, orders)
// DO NOT import this in Client Components
//
// Split into lib/supabase/products.ts (product CRUD) and
// lib/supabase/orders.ts (order operations); re-exported here for backward
// compatibility with existing imports of '@/lib/supabase/db'.
//
// createOrder is no longer re-exported: both copies of it called the dropped
// stock RPCs and had no callers. Use lib/commerce/create-order.ts.
//
// NOTE: verifyAdmin (a stubbed email/password check against
// ADMIN_EMAIL/ADMIN_PASSWORD env vars) previously lived in this file. It had
// zero call sites anywhere in the repo - the real admin-auth path is
// lib/auth.ts's verifyAdminAuth + JWT cookie - so it was removed as dead code.

export type { Product } from '@/types/product'
export type { Order, OrderItem } from '@/types/order'

export { createProduct, updateProduct, deleteProduct } from './products'
export { getOrders, updateOrderStatus } from './orders'
