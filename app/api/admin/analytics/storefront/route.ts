// app/api/admin/analytics/storefront/route.ts - the funnel, and who has
// traffic with no sale to show for it.
//
// Both come from storefront_events (supabase/migrations/20260908000200), read
// through two SQL functions rather than built up here: the funnel needs a
// distinct-session count per stage and the candidate list needs a
// zero-purchase filter, and both are cheaper to express once in SQL than to
// reconstruct from raw rows on every dashboard load.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';

export const maxDuration = 30;

const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 180;
const TRAFFIC_CANDIDATE_LIMIT = 20;

function parseWindowDays(request: Request): number {
  const raw = Number(new URL(request.url).searchParams.get('windowDays'));
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_WINDOW_DAYS;
  return Math.min(raw, MAX_WINDOW_DAYS);
}

export const GET = withAdminAuth(async (request, { supabase }) => {
  const windowDays = parseWindowDays(request);

  const [funnelResult, trafficResult] = await Promise.all([
    supabase.rpc('storefront_funnel', { p_window_days: windowDays }),
    supabase.rpc('storefront_traffic_without_sales', {
      p_window_days: windowDays,
      p_limit: TRAFFIC_CANDIDATE_LIMIT,
    }),
  ]);

  if (funnelResult.error || trafficResult.error) {
    console.error(
      'Storefront analytics query failed:',
      funnelResult.error?.message ?? trafficResult.error?.message
    );
    return NextResponse.json(
      { success: false, error: 'Could not load storefront analytics.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    windowDays,
    funnel: funnelResult.data ?? [],
    trafficWithoutSales: trafficResult.data ?? [],
  });
});
