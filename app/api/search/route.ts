// app/api/search/route.ts - public product search.
//
// Serves both the header typeahead and the full results page, so the two can
// never disagree about what a query matches. GET rather than POST because a
// search is a read and the result is cacheable per query.
//
// The tsquery is built inside search_products() in Postgres, not here. That is
// deliberate: one place turns arbitrary visitor input into a query, and it does
// it by rebuilding the string from word characters rather than interpolating
// what was typed.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { withRateLimit } from '@/lib/api/rate-limit';
import { RATE_LIMITS } from '@/lib/api/rate-limit-rules';
import {
  normaliseSearchQuery,
  isSearchable,
  MIN_QUERY_LENGTH,
} from '@/lib/commerce/search-query';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Typeahead wants a handful; the results page wants a page's worth. */
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 50;

function parseLimit(value: string | null): number {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit < 1) return DEFAULT_LIMIT;
  return Math.min(Math.trunc(limit), MAX_LIMIT);
}

/**
 * Records what was searched for and how many results it returned.
 *
 * Best-effort and never awaited on the critical path's behalf — a failed log
 * write must not cost the visitor their results. The zero-result rows are the
 * point: they are a list, in customers' own words, of what the catalogue does
 * not cover or does not name the way people say it.
 */
async function logSearch(supabase: SupabaseClient, query: string, resultCount: number): Promise<void> {
  const { error } = await supabase
    .from('search_queries')
    .insert({ query, result_count: resultCount });

  if (error) {
    console.error(`Search log failed for "${query}": ${error.message}`);
  }
}

/**
 * Categories and subcategories whose name contains the query.
 *
 * Cheap, and it answers a different question from the product list: someone
 * typing "gown" may want the whole gowns section rather than one product.
 */
async function matchingCategories(supabase: SupabaseClient, query: string) {
  const { data, error } = await supabase
    .from('categories')
    .select('name, slug, subcategories(name, slug, category_slug)');

  if (error || !data) return [];

  const suggestions: Array<{ label: string; href: string }> = [];

  for (const category of data) {
    if (category.name?.toLowerCase().includes(query)) {
      suggestions.push({ label: category.name, href: `/products?category=${category.slug}` });
    }

    for (const sub of (category as any).subcategories ?? []) {
      if (sub.name?.toLowerCase().includes(query)) {
        suggestions.push({
          label: `${category.name} › ${sub.name}`,
          href: `/products?category=${category.slug}&subcategory=${sub.slug}`,
        });
      }
    }
  }

  return suggestions.slice(0, 4);
}

async function search(request: NextRequest) {
  const url = new URL(request.url);
  const raw = url.searchParams.get('q');
  const query = normaliseSearchQuery(raw);
  const limit = parseLimit(url.searchParams.get('limit'));

  if (!isSearchable(raw)) {
    return NextResponse.json({
      success: true,
      query,
      products: [],
      categories: [],
      message: `Type at least ${MIN_QUERY_LENGTH} characters to search.`,
    });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('search_products', {
    p_query: query,
    p_limit: limit,
  });

  if (error) {
    console.error('Search failed:', error);
    return NextResponse.json(
      { success: false, error: 'Search is unavailable right now. Please try again.', products: [], categories: [] },
      { status: 503 }
    );
  }

  const products = data ?? [];
  const categories = await matchingCategories(supabase, query);

  // Awaited so the log is durable, but its failure is swallowed inside.
  await logSearch(supabase, query, products.length);

  return NextResponse.json({
    success: true,
    query,
    products,
    categories,
    total: products.length,
  });
}

export const GET = withRateLimit(
  RATE_LIMITS.search,
  search,
  'Too many searches. Please wait a moment and try again.'
);
