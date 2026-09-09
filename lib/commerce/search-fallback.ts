/**
 * COMMERCE layer (server only) — what to offer instead of a dead end when a
 * search matches nothing.
 *
 * Two cheap reads, both server-side: the nearest product names by trigram
 * similarity (suggest_products()), and the busiest categories to browse
 * instead (top_categories()). Neither is cached — this only ever runs on a
 * genuine zero-result page, which is not a hot path.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin-server';

export interface ProductSuggestion {
  id: string;
  name: string;
  mainImage: string | null;
}

export interface CategorySuggestion {
  name: string;
  slug: string;
}

export interface SearchFallback {
  suggestions: ProductSuggestion[];
  categories: CategorySuggestion[];
}

const SUGGESTION_LIMIT = 5;
const CATEGORY_LIMIT = 3;

export async function loadSearchFallback(query: string): Promise<SearchFallback> {
  const supabase = createAdminClient();

  const [suggestionsResult, categoriesResult] = await Promise.all([
    supabase.rpc('suggest_products', { p_query: query, p_limit: SUGGESTION_LIMIT }),
    supabase.rpc('top_categories', { p_limit: CATEGORY_LIMIT }),
  ]);

  if (suggestionsResult.error) {
    console.error('Search suggestions failed:', suggestionsResult.error.message);
  }
  if (categoriesResult.error) {
    console.error('Top categories failed:', categoriesResult.error.message);
  }

  return {
    suggestions: ((suggestionsResult.data ?? []) as Array<{
      id: string;
      name: string;
      main_image: string | null;
    }>).map((row) => ({ id: row.id, name: row.name, mainImage: row.main_image })),
    categories: ((categoriesResult.data ?? []) as Array<{ name: string; slug: string }>).map((row) => ({
      name: row.name,
      slug: row.slug,
    })),
  };
}
