// app/api/admin/customers/route.ts - the buyer list behind the admin customer
// view. Reads customer_stats, the view that derives order counts and lifetime
// value from orders on read, so the figures here can never be stale.
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { withAdminAuth } from '@/lib/api/with-admin-auth';

/** Server-side paging, so the list stays usable as the store grows. */
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/** Columns a caller may order by. An allowlist, because this value reaches the
 * query builder — anything else would let the URL choose the sort expression. */
const SORTABLE = {
  lifetime_value: 'lifetime_value',
  orders_revenue: 'orders_revenue',
  orders_total: 'orders_total',
  last_order_at: 'last_order_at',
  first_order_at: 'first_order_at',
  email: 'email',
} as const;

type SortKey = keyof typeof SORTABLE;

function parseSort(value: string | null): SortKey {
  return value && value in SORTABLE ? (value as SortKey) : 'lifetime_value';
}

function parseSize(value: string | null): number {
  const size = Number(value);
  if (!Number.isFinite(size) || size < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.trunc(size), MAX_PAGE_SIZE);
}

async function listCustomers(supabase: SupabaseClient<Database>, request: NextRequest) {
  const url = new URL(request.url);
  const search = (url.searchParams.get('search') ?? '').trim();
  const sort = parseSort(url.searchParams.get('sort'));
  const ascending = url.searchParams.get('direction') === 'asc';
  const pageSize = parseSize(url.searchParams.get('pageSize'));
  const page = Math.max(0, Math.trunc(Number(url.searchParams.get('page')) || 0));

  let query = supabase
    .from('customer_stats')
    .select('*', { count: 'exact' })
    .order(SORTABLE[sort], { ascending, nullsFirst: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (search) {
    // Escape the PostgREST `or` metacharacters so a comma or paren in the
    // search box cannot break out of the filter expression.
    const safe = search.replace(/[,()\\]/g, ' ').trim();
    if (safe) {
      query = query.or(`email.ilike.%${safe}%,full_name.ilike.%${safe}%,phone_e164.ilike.%${safe}%`);
    }
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error listing customers:', error);
    return NextResponse.json(
      { success: false, error: `Failed to load customers: ${error.message}`, customers: [] },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    customers: data ?? [],
    page,
    pageSize,
    total: count ?? 0,
  });
}

export const GET = withAdminAuth((request, { supabase }) => listCustomers(supabase, request));
