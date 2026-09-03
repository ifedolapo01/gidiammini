// app/api/admin/audit-log/route.ts - the activity feed, and the per-entity
// "History" query behind an order's or product's History tab.
//
// Read-only by design. Entries are written by withAdminAuth as a side effect of
// the actions they describe; there is no endpoint for creating one, because an
// audit entry nobody can forge is worth more than one anybody can post.
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { withAdminAuth } from '@/lib/api/with-admin-auth';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/** Filters a caller may apply, as an allowlist — these values reach the query
 * builder, so the URL must not be able to choose the column. */
const FILTERABLE = ['entity_type', 'entity_id', 'action', 'actor_email'] as const;

function parseSize(value: string | null): number {
  const size = Number(value);
  if (!Number.isFinite(size) || size < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.trunc(size), MAX_PAGE_SIZE);
}

async function listAuditLog(supabase: SupabaseClient<Database>, request: NextRequest) {
  const url = new URL(request.url);
  const pageSize = parseSize(url.searchParams.get('pageSize'));
  const page = Math.max(0, Math.trunc(Number(url.searchParams.get('page')) || 0));

  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  for (const field of FILTERABLE) {
    const value = url.searchParams.get(field);
    if (value) query = query.eq(field, value);
  }

  // Date range, for "what happened last Tuesday".
  const since = url.searchParams.get('since');
  if (since) query = query.gte('created_at', since);
  const until = url.searchParams.get('until');
  if (until) query = query.lte('created_at', until);

  // The feed is noisy without this: every mutating request writes at least a
  // generic 'request' entry, and those are a backstop for routes that describe
  // nothing rather than something an operator wants to read. Opt in with
  // ?include=all.
  if (url.searchParams.get('include') !== 'all') {
    query = query.neq('action', 'request');
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error reading audit log:', error);
    return NextResponse.json(
      { success: false, error: `Failed to load activity: ${error.message}`, entries: [] },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    entries: data ?? [],
    page,
    pageSize,
    total: count ?? 0,
  });
}

export const GET = withAdminAuth((request, { supabase }) => listAuditLog(supabase, request));
