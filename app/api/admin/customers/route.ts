// app/api/admin/customers/route.ts - the buyer list behind the admin customer
// view. Reads customer_stats, the view that derives order counts and lifetime
// value from orders on read, so the figures here can never be stale.
//
// Takes the same query shape as every other admin list (lib/api/list-params.ts)
// and answers with the same { items, meta } envelope, so the page is built from
// useListParams / useListData / TablePagination rather than from a paging
// implementation of its own. It previously used a 0-based page and a
// `pageSize` of its own invention, which no client had yet been written
// against.
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { parseListParams, listMeta } from '@/lib/api/list-params';

/** Columns a caller may order by. An allowlist, because this value reaches the
 * query builder — anything else would let the URL choose the sort expression. */
export const CUSTOMER_SORTABLE = [
  'lifetime_value',
  'net_lifetime_value',
  'orders_revenue',
  'orders_total',
  'orders_cancelled',
  'last_order_at',
  'first_order_at',
  'email',
] as const;

/**
 * Every tag in use, for the filter control.
 *
 * Read from the customers table rather than kept as a vocabulary of its own:
 * a tag exists because somebody applied it, and a list of tags nobody is
 * carrying is a list of typos. Capped, because a filter dropdown past a few
 * dozen entries is not a filter.
 */
async function usedTags(supabase: SupabaseClient<Database>): Promise<string[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('tags')
    .not('tags', 'eq', '{}')
    .limit(1000);

  if (error) {
    // A missing filter is not worth failing the page for.
    console.error('Tag facet lookup failed:', error.message);
    return [];
  }

  const seen = new Set<string>();
  for (const row of data ?? []) {
    for (const tag of (row as { tags: string[] | null }).tags ?? []) seen.add(tag);
  }

  return [...seen].sort().slice(0, 60);
}

async function listCustomers(supabase: SupabaseClient<Database>, request: NextRequest) {
  const url = new URL(request.url);
  const params = parseListParams(url, {
    sortable: CUSTOMER_SORTABLE,
    defaultSort: 'lifetime_value',
    defaultDirection: 'desc',
  });

  const tag = (url.searchParams.get('tag') ?? '').trim().toLowerCase();
  const blocked = url.searchParams.get('blocked');

  let query = supabase
    .from('customer_stats')
    .select('*', { count: 'exact' })
    .order(params.sort, { ascending: params.ascending, nullsFirst: false })
    // A stable tiebreaker. Two customers with the same lifetime value would
    // otherwise be free to swap places between pages.
    .order('customer_id', { ascending: true })
    .range(params.from, params.to);

  if (params.search) {
    // Escape the PostgREST `or` metacharacters so a comma or paren in the
    // search box cannot break out of the filter expression.
    const safe = params.search.replace(/[,()\\]/g, ' ').trim();
    if (safe) {
      query = query.or(`email.ilike.%${safe}%,full_name.ilike.%${safe}%,phone_e164.ilike.%${safe}%`);
    }
  }

  if (tag) {
    // `contains` compiles to @>, which customers_tags_idx serves. The tag is
    // passed as a value rather than interpolated into a filter string, so its
    // own punctuation cannot alter the query.
    query = query.contains('tags', [tag]);
  }

  if (blocked === 'true' || blocked === 'false') {
    query = query.eq('is_blocked', blocked === 'true');
  }

  const [{ data, error, count }, tags] = await Promise.all([query, usedTags(supabase)]);

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
    tags,
    meta: listMeta(params, count ?? 0),
  });
}

export const GET = withAdminAuth((request, { supabase }) => listCustomers(supabase, request));
