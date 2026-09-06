/**
 * ADMIN layer — the store settings, for admin screens that need to agree with
 * the storefront.
 *
 * The storefront gets these from the server through StoreSettingsProvider,
 * seeded in the root layout. The Admin cannot: app/admin/layout.tsx is a client
 * component, so there is no server render to seed from. This fetches instead.
 *
 * Shared across every caller through a module-level promise rather than a
 * context, because the alternative is a provider in a layout that would fetch
 * on mount anyway, and because two panels open at once must not produce two
 * requests for a row that changes about once a year. The promise is the cache:
 * the first hook to mount starts the request, every later one awaits the same
 * one, and `invalidate()` clears it after a save so the next read is fresh.
 *
 * Returns the defaults until the fetch lands. A tax preview that shows 7.5%
 * for 200ms and then corrects itself is better than one that shows nothing, and
 * the server is the authority for every total either way.
 */
'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_STORE_SETTINGS, settingsFromRow } from '@/lib/commerce/store-settings';
import type { StoreSettings } from '@/types/settings';

let cached: Promise<StoreSettings> | null = null;

async function fetchSettings(): Promise<StoreSettings> {
  try {
    const response = await fetch('/api/admin/settings');
    if (!response.ok) throw new Error(`Settings request failed: ${response.status}`);
    const data = await response.json();
    return data?.settings ? (data.settings as StoreSettings) : DEFAULT_STORE_SETTINGS;
  } catch (error) {
    // Not surfaced to the operator. Every caller has a working fallback, and a
    // toast saying "could not load settings" over an order they are trying to
    // edit is noise about a number they were not looking at.
    console.error('Error loading store settings:', error);
    return DEFAULT_STORE_SETTINGS;
  }
}

/** Drops the shared cache. Called by the Settings page after a successful
 *  save, so a panel opened next reads the new values. */
export function invalidateAdminStoreSettings(): void {
  cached = null;
}

export function useAdminStoreSettings(): StoreSettings {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);

  useEffect(() => {
    let active = true;
    cached ??= fetchSettings();
    cached.then((loaded) => {
      if (active) setSettings(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  return settings;
}

/** Re-exported so a caller that already has a raw row (the Settings page's own
 *  save response) can normalise it without a second import. */
export { settingsFromRow };
