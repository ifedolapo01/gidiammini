/**
 * COMMERCE layer (server only) — the swatch colours and hover image for a card,
 * for surfaces that go through product_cards() rather than list_products().
 *
 * product_cards() only ever returns main_image, not colors or images — see
 * attachReviewStats in review-query.ts for why that projection stays as-is:
 * four surfaces share it, and widening its return type means re-emitting a
 * 150-line SQL function every time a card grows a field. Merged in
 * TypeScript instead, the same way the star row is.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin-server';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CardMedia {
  colors: string[];
  images: string[];
}

/** Media for a set of product ids, keyed by id. Absent means the product had
 *  neither — the card then draws no swatches and no hover image. */
export async function loadCardMedia(
  productIds: string[],
  supabase: SupabaseClient = createAdminClient()
): Promise<Map<string, CardMedia>> {
  const found = new Map<string, CardMedia>();
  if (productIds.length === 0) return found;

  const { data, error } = await supabase.from('products').select('id, colors, images').in('id', productIds);

  if (error) {
    // Swatches and the hover image are an enhancement to a card that already
    // works without them.
    console.error('Card media lookup failed:', error.message);
    return found;
  }

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    found.set(String(row.id), {
      colors: (row.colors as string[] | null) ?? [],
      images: (row.images as string[] | null) ?? [],
    });
  }

  return found;
}

/** Merges colors/images into a page of product_cards() rows, in place of the
 *  caller doing it — see cardsFor() in recommendations.ts. */
export async function attachCardMedia<T extends { id: string }>(
  rows: T[],
  supabase: SupabaseClient = createAdminClient()
): Promise<Array<T & Partial<CardMedia>>> {
  if (rows.length === 0) return rows;

  const media = await loadCardMedia(rows.map((row) => row.id), supabase);
  if (media.size === 0) return rows;

  return rows.map((row) => ({ ...row, ...media.get(row.id) }));
}
