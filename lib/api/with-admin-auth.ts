// lib/api/with-admin-auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin-server';
import type { SupabaseClient } from '@supabase/supabase-js';

type AdminRouteHandler = (
  request: NextRequest,
  ctx: { supabase: SupabaseClient; params: any }
) => Promise<NextResponse>;

/**
 * Wraps an admin API route handler with auth verification, a shared
 * service-role Supabase client, and a standard error-response shape.
 */
export function withAdminAuth(handler: AdminRouteHandler) {
  return async (request: NextRequest, routeCtx?: { params: any }) => {
    const isAuthed = await verifyAdminAuth(request);
    if (!isAuthed) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const supabase = createAdminClient();
      return await handler(request, { supabase, params: routeCtx?.params });
    } catch (error: any) {
      console.error('Admin API error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error', details: error.message },
        { status: 500 }
      );
    }
  };
}
