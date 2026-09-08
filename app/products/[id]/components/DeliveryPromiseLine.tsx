/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// "When will it arrive?" is the second question after "how much?", and until
// now the answer only existed inside checkout — after the decision to buy was
// already made. This is that same answer (computeDeliveryWindow, the same
// pure function ProductDetailsAccordion and the cart drawer already call),
// moved up next to Add to Cart where it can still change someone's mind.
//
// No address exists yet, so the zone is either a remembered choice from an
// earlier visit or the admin's designated primary zone — see
// useDeliveryZonePreference. "Change" swaps in a plain <select> rather than a
// drawer: this is a one-line component, not a second checkout.
'use client';

import { useState } from 'react';
import { Truck, ChevronDown } from 'lucide-react';
import { useActiveShippingZones } from '@/components/checkout/hooks/useActiveShippingZones';
import { computeDeliveryWindow, formatDeliveryWindow } from '@/lib/commerce/delivery-promise';
import { useNow } from '../hooks/useNow';
import { useDeliveryZonePreference } from '../hooks/useDeliveryZonePreference';

export default function DeliveryPromiseLine() {
  const { zones } = useActiveShippingZones();
  const now = useNow(60_000);
  const { zone, states, setState } = useDeliveryZonePreference(zones);
  const [changing, setChanging] = useState(false);

  if (!zone) return null;

  const window = computeDeliveryWindow(now, zone);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-body-sm text-text-secondary">
      <Truck className="h-4 w-4 shrink-0 text-info" aria-hidden="true" />
      {changing ? (
        <label className="sr-only" htmlFor="delivery-zone-state">
          Delivery state
        </label>
      ) : null}
      {changing ? (
        <select
          id="delivery-zone-state"
          autoFocus
          value={zone.state}
          onChange={(event) => {
            setState(event.target.value);
            setChanging(false);
          }}
          onBlur={() => setChanging(false)}
          className="rounded-control border border-border bg-surface px-2 py-1 text-body-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {states.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      ) : (
        <>
          <span>
            Delivered to <span className="font-medium text-text-primary">{zone.state}</span> by{' '}
            <span className="font-medium text-text-primary">
              {formatDeliveryWindow(window.start, window.end)}
            </span>
          </span>
          {states.length > 1 && (
            <button
              type="button"
              onClick={() => setChanging(true)}
              className="inline-flex items-center gap-0.5 rounded-control font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            >
              Change
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
