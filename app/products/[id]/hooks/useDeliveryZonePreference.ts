/**
 * STOREFRONT layer — which zone the delivery-promise line quotes.
 *
 * There is no address and no session before checkout, so there is nothing to
 * resolve a zone from except what this browser told us on an earlier visit.
 * That remembered choice — a state name in localStorage — wins when it still
 * matches an active zone; everywhere else on the page falls back to the
 * admin's designated primary zone (ProductDetailsAccordion, CartDrawer), and
 * this does the same so the two headline estimates never disagree by default.
 */
import { useEffect, useMemo, useState } from 'react';
import type { ShippingZone } from '@/types/shipping';

const STORAGE_KEY = 'gidiammini_delivery_zone_state';

export function useDeliveryZonePreference(zones: ShippingZone[]) {
  const [preferredState, setPreferredState] = useState<string | null>(null);

  useEffect(() => {
    try {
      setPreferredState(localStorage.getItem(STORAGE_KEY));
    } catch {
      // Private browsing or storage disabled — the primary-zone default still works.
    }
  }, []);

  const states = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const z of zones) {
      if (z.is_active && !seen.has(z.state)) {
        seen.add(z.state);
        ordered.push(z.state);
      }
    }
    return ordered;
  }, [zones]);

  const zone = useMemo(() => {
    const active = zones.filter((z) => z.is_active);
    const preferred = preferredState ? active.find((z) => z.state === preferredState) : undefined;
    return preferred ?? active.find((z) => z.is_primary) ?? active[0] ?? null;
  }, [zones, preferredState]);

  function setState(state: string) {
    setPreferredState(state);
    try {
      localStorage.setItem(STORAGE_KEY, state);
    } catch {
      // Nothing to persist to; the choice still applies for this render.
    }
  }

  return { zone, states, setState };
}
