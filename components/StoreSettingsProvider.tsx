/**
 * STOREFRONT layer — the shopper-facing settings, for components too deep to
 * be handed them.
 *
 * The same shape as CategoryProvider, and for the same reason: the root layout
 * reads the settings once per request (cached, so it is not a query per page)
 * and seeds this, rather than every consumer fetching them. The consumers are
 * scattered — the cart summary needs the tax rate, the checkout's payment step
 * needs the bank details, a stock badge needs the low-stock threshold — and
 * threading four props from the layout through each of those routes would be
 * worse than a context.
 *
 * Seeded from the server, so there is no client fetch, no loading state, and
 * no first paint showing a stale rate.
 *
 * Only ever the public subset. What may cross into a browser is decided by the
 * store_settings_public view and narrowed again by toPublicSettings() — not by
 * whatever this component happens to be passed.
 */
'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { DEFAULT_STORE_SETTINGS, toPublicSettings } from '@/lib/commerce/store-settings';
import type { PublicStoreSettings } from '@/types/settings';

const StoreSettingsContext = createContext<PublicStoreSettings | undefined>(undefined);

export function StoreSettingsProvider({
  settings,
  children,
}: {
  settings: PublicStoreSettings;
  children: ReactNode;
}) {
  // No useMemo: the value is a plain object read from the server and replaced
  // only when the whole tree re-renders from a new request, so memoising it
  // would guard against a re-render that does not happen.
  return <StoreSettingsContext.Provider value={settings}>{children}</StoreSettingsContext.Provider>;
}

/**
 * Like useCategoryNav and unlike useCart, this does not throw without a
 * provider. A stock badge or a currency line rendered outside the storefront
 * layout — in the Admin, in a test — should fall back to the values the code
 * used before the settings table existed, not blank the page. Getting 7.5% on
 * a screen that should have said 10% is a wrong label; a thrown error is a
 * checkout nobody can finish.
 */
export function useStoreSettings(): PublicStoreSettings {
  return useContext(StoreSettingsContext) ?? toPublicSettings(DEFAULT_STORE_SETTINGS);
}
