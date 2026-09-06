/**
 * COMMERCE layer (server only) — reading the settings, and dropping the cache.
 *
 * Two readers, because there are two questions:
 *
 *   loadPublicStoreSettings()   the shopper-facing subset, cached. Every
 *                               storefront render and every price calculation
 *                               goes through this, so it must not be a
 *                               database round trip per request.
 *   readStoreSettings(client)   the whole row, uncached, service-role. Only
 *                               the Admin asks, and an owner who has just
 *                               pressed Save must not be shown the value they
 *                               replaced.
 *
 * The cache tag is its own export so the settings route can drop it without
 * importing the loader — the same shape as PRODUCTS_CACHE_TAG, and for the
 * same reason: a save that leaves the storefront quoting the old tax rate for
 * the next hour reads as a save that did not work.
 */
import 'server-only';
import { unstable_cache, revalidateTag } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createPublicClient } from '@/lib/supabase/public-server';
import type { PublicStoreSettings, StoreSettings } from '@/types/settings';
import { DEFAULT_STORE_SETTINGS, publicSettingsFromRow, settingsFromRow } from './store-settings';

export const STORE_SETTINGS_CACHE_TAG = 'store-settings';

/** An hour, as an upper bound only — a save drops the tag immediately, so this
 *  is what protects a shop whose revalidation was missed rather than the
 *  normal path. */
const CACHE_SECONDS = 3600;

async function fetchPublicStoreSettings(): Promise<PublicStoreSettings> {
  const supabase = createPublicClient();

  // The view, not the table: anon has no grant on store_settings, and asking
  // for it would return an empty result rather than an error.
  const { data, error } = await supabase
    .from('store_settings_public')
    .select('*')
    .maybeSingle();

  if (error || !data) {
    // Not fatal, on purpose. See the note on DEFAULT_STORE_SETTINGS: falling
    // back means an unapplied migration or a brief outage leaves the shop
    // pricing exactly as it did before this table existed, instead of taking
    // the checkout down over a configuration read.
    if (error) console.error('Error reading store settings, using defaults:', error);
    return publicSettingsFromRow(null);
  }

  return publicSettingsFromRow(data);
}

export const loadPublicStoreSettings = unstable_cache(
  fetchPublicStoreSettings,
  ['store-settings-public'],
  { tags: [STORE_SETTINGS_CACHE_TAG], revalidate: CACHE_SECONDS }
);

/** The full row, for the Admin. Needs a service-role client — the base table
 *  is closed to everyone else. */
export async function readStoreSettings(supabase: SupabaseClient): Promise<StoreSettings> {
  const { data, error } = await supabase
    .from('store_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw error;
  // A missing row is the state of a database whose migration has not run yet.
  // The Settings page should show the values the code is actually using, which
  // is what the defaults are.
  return data ? settingsFromRow(data) : DEFAULT_STORE_SETTINGS;
}

/** Called after a successful settings write. Storefront pages, the price
 *  quote and the cart summary all read through the cached loader. */
export function revalidateStoreSettings(): void {
  revalidateTag(STORE_SETTINGS_CACHE_TAG, 'max');
}
