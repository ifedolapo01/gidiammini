// lib/supabase/admin-server.ts - UPDATED
import { createClient } from '@supabase/supabase-js'

// This uses the service role key - ONLY use on server
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // Check for required environment variables
  if (!supabaseUrl) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not defined');
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined');
  }
  
  if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not defined');
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined');
  }
  
  console.log('🔧 Creating admin client with URL:', supabaseUrl);
  
  return createClient(
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