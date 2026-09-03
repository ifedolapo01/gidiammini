// lib/supabase/public-server.ts — the anon key, on the server, without cookies.
//
// The other three factories all rule themselves out for public server
// rendering: ./client is the browser's, ./server reads cookies() (which opts
// the caller out of every cache Next has, so a product page or a sitemap built
// on it must be re-rendered per request), and ./admin-server holds the service
// role, which has no business fetching a page anyone can see anyway.
//
// This one reads exactly what the storefront is allowed to read, and touches
// no request state, so pages built on it can be cached and revalidated.
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set')
  }

  return createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}
