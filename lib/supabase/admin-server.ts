// lib/supabase/admin-server.ts - UPDATED
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { signAppServiceToken } from './app-service-token'

function requireSupabaseUrl(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not defined');
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined');
  }
  return supabaseUrl;
}

// The store-scoped client: everyday admin/API data access. Authenticates as
// app_service (see supabase/migrations/20260911100000_store_dimension_and_scoping.sql)
// rather than the raw service-role key, so Postgres's store-scoping RLS
// policies apply to it. `apikey` stays the anon key (required by the
// gateway); `Authorization` carries the app_service JWT that actually
// determines the executing Postgres role.
export function createAdminClient() {
  const supabaseUrl = requireSupabaseUrl();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!anonKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined');
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined');
  }

  return createClient<Database>(
    supabaseUrl,
    anonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${signAppServiceToken()}`
        }
      }
    }
  )
}

// The real service-role key: full RLS bypass, across every store. Reserved
// for work that must genuinely cross store boundaries -- nothing in this
// codebase needs that today. Prefer createAdminClient() unless you can name
// the cross-store reason.
export function createSuperAdminClient() {
  const supabaseUrl = requireSupabaseUrl();
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not defined');
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined');
  }

  return createClient<Database>(
    supabaseUrl,
    supabaseServiceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    }
  )
}

// Also export a simple function to test the connection
export async function testAdminConnection() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('orders').select('count').limit(1);
    
    if (error) {
      console.error('❌ Admin connection test failed:', error);
      return { success: false, error: error.message };
    }
    
    console.log('✅ Admin connection test successful');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Admin connection test error:', error);
    return { success: false, error: error.message };
  }
}