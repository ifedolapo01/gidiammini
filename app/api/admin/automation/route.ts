/**
 * The automation rules, and the switch on each.
 *
 * GET lists them with their recent activity. PATCH toggles one.
 *
 * Deliberately no create or delete. Until there is a builder UI a rule's
 * trigger is a function name, so a rule created through an API would be one
 * whose trigger does not exist — see the header of
 * lib/commerce/automation/triggers.ts. What an owner needs today is to read
 * what the three built-ins do and decide whether each may run.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, type AdminRouteContext } from '@/lib/api/with-admin-auth';

export const dynamic = 'force-dynamic';

/** Recent activity shown per rule. Enough to see it working, not a log. */
const RECENT_RUNS = 5;

async function listRules({ supabase }: AdminRouteContext) {
  const { data: rules, error } = await supabase
    .from('automation_rules')
    .select('*')
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    // Almost always a deployment that has not applied 20260906160000. The page
    // says so rather than failing.
    console.error('Could not read automation rules:', error);
    return NextResponse.json({ success: true, rules: [], recent: [], unavailable: true });
  }

  const { data: recent } = await supabase
    .from('automation_rule_runs')
    .select('id, rule_id, subject_label, outcome, detail, ran_at, times_run')
    .order('ran_at', { ascending: false })
    .limit(RECENT_RUNS * Math.max(1, rules?.length ?? 1));

  return NextResponse.json({ success: true, rules: rules ?? [], recent: recent ?? [] });
}

async function toggleRule(request: NextRequest, { supabase, audit }: AdminRouteContext) {
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : null;
  const isActive = typeof body?.is_active === 'boolean' ? body.is_active : null;

  if (!id || isActive === null) {
    return NextResponse.json(
      { success: false, error: 'Which rule, and on or off?' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('automation_rules')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, name, is_active')
    .single();

  if (error || !data) {
    console.error('Could not toggle automation rule:', error);
    return NextResponse.json({ success: false, error: 'Could not change that rule.' }, { status: 400 });
  }

  // Its own entry rather than the automatic request one: switching on a rule
  // that cancels orders is exactly the kind of thing somebody asks about
  // later, and "who turned this on" should be one search.
  audit({
    entityType: 'request',
    entityId: data.id,
    action: 'update',
    after: { rule: data.name, is_active: data.is_active },
  });

  return NextResponse.json({ success: true, rule: data });
}

export const GET = withAdminAuth((_request, ctx) => listRules(ctx));
export const PATCH = withAdminAuth((request, ctx) => toggleRule(request, ctx));
