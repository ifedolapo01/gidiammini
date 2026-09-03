// app/api/cron/customer-auth/route.ts - sweeping up spent sign-in links and
// lapsed sessions.
//
// Neither table is interesting once its rows are dead: a used or expired
// challenge is a row nobody will ever look up again, and a lapsed session is
// already refused by readSession. Left alone they grow forever, and they are
// the two tables in this database that hold credentials — a smaller pile of
// those is worth having for its own sake.
//
// Fails closed: an unprotected URL that deletes rows is an unprotected URL
// that deletes rows.
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { authorizeCron } from '@/lib/api/cron-auth';

export async function GET(req: NextRequest) {
  const denied = authorizeCron(req, { failClosed: true, jobName: 'the customer sign-in sweep' });
  if (denied) return denied;

  try {
    // Typed loosely until `npm run db:types` reruns against a database that
    // has migration 003600 — prune_customer_auth is not in the generated types
    // yet.
    const supabase: SupabaseClient = createAdminClient();

    const { data, error } = await supabase.rpc('prune_customer_auth', { p_keep_days: 30 });
    if (error) throw new Error(error.message);

    // The function returns one row of two counts.
    const swept = (data as unknown as Array<{ tokens_deleted: number; sessions_deleted: number }>)?.[0];
    const tokens = Number(swept?.tokens_deleted ?? 0);
    const sessions = Number(swept?.sessions_deleted ?? 0);

    console.log(`Customer auth sweep removed ${tokens} sign-in link(s) and ${sessions} session(s).`);

    return NextResponse.json({ success: true, tokens, sessions });
  } catch (error: any) {
    console.error('Customer auth sweep failed:', error);
    return NextResponse.json(
      { success: false, error: 'Sweep failed.', detail: error.message },
      { status: 500 }
    );
  }
}
