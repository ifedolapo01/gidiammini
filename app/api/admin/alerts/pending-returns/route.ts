// app/api/admin/alerts/pending-returns/route.ts - how many returns are still
// in progress (not yet rejected or refunded), for the alert ticker.
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAdminAuth } from '@/lib/api/with-admin-auth';

export const GET = withAdminAuth(async (_request, { supabase }) => {
  // Typed loosely until `npm run db:types` reruns against a database that has
  // this migration — returns is not in the generated types yet.
  const { count, error } = await (supabase as unknown as SupabaseClient)
    .from('returns')
    .select('id', { count: 'exact', head: true })
    .not('status', 'in', '(rejected,refunded)');

  if (error) {
    console.error('Error counting pending returns:', error);
    // 200 with a zero, like its sibling alert routes: the ticker treats a
    // missing source as "nothing to say", and a 500 here would put a scary
    // console error in front of an admin over a decoration.
    return NextResponse.json({ success: false, pendingCount: 0 });
  }

  return NextResponse.json({ success: true, pendingCount: count ?? 0 });
});
