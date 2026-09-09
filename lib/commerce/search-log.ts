/**
 * COMMERCE layer (server only) — recording what was searched for.
 *
 * Shared by the typeahead (/api/search) and the full results page
 * (/search/page.tsx), so a search logs exactly once wherever it was made from,
 * rather than each surface keeping its own copy of this. Zero-result rows are
 * the point: they are a list, in customers' own words, of what the catalogue
 * does not cover or does not name the way people say it — see
 * zero_result_searches and /admin/search.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Best-effort: a failed log write must not cost the visitor their results, so
 * this swallows its own error rather than throwing.
 */
export async function logSearchQuery(
  supabase: SupabaseClient,
  query: string,
  resultCount: number
): Promise<void> {
  const { error } = await supabase
    .from('search_queries')
    .insert({ query, result_count: resultCount });

  if (error) {
    console.error(`Search log failed for "${query}": ${error.message}`);
  }
}
