/** STOREFRONT layer — bundles checkout's State/LGA/Place + delivery-option
 * selection and the derived zone/fee/pickup values they resolve to. */
'use client';

import { useEffect, useState } from 'react';
import { getDeliveryFee, isPickupAvailable, findShippingZone, getAvailableStates } from '@/lib/commerce/checkout';
import { useActiveShippingZones } from './useActiveShippingZones';

/** Where a returning customer had got to, when this is a restored checkout. */
export interface InitialShippingSelection {
  deliveryOption: 'pickup' | 'delivery';
  selectedState: string;
  selectedLga: string;
  selectedPlace: string;
}

export function useCheckoutShipping(initial?: InitialShippingSelection | null) {
  const [deliveryOption, setDeliveryOption] = useState<'pickup' | 'delivery'>(
    initial?.deliveryOption ?? 'pickup'
  );
  // 'Abuja' only when nothing was restored — a returning customer's own choice
  // outranks the guess, and the effect below would otherwise re-resolve it.
  const [selectedState, setSelectedState] = useState<string>(initial?.selectedState || 'Abuja');
  const [selectedLga, setSelectedLga] = useState<string>(initial?.selectedLga ?? '');
  const [selectedPlace, setSelectedPlace] = useState<string>(initial?.selectedPlace ?? '');

  const { zones } = useActiveShippingZones();

  // 'Abuja' is just a starting guess — once zones load, fall back to whatever
  // state the admin has actually configured if that guess isn't available.
  useEffect(() => {
    if (zones.length === 0) return;
    const available = getAvailableStates(zones);
    if (available.length > 0 && !available.includes(selectedState)) {
      setSelectedState(available[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones]);

  const selectedZone = findShippingZone(zones, selectedState, selectedLga, selectedPlace);
  const pickupAvailable = isPickupAvailable(zones, selectedState, selectedLga, selectedPlace);
  const shippingCost = deliveryOption === 'pickup'
    ? 0
    : getDeliveryFee(zones, selectedState, selectedLga, selectedPlace);
  const pickupAddress = selectedZone?.pickup_address ?? '';

  return {
    zones,
    deliveryOption, setDeliveryOption,
    selectedState, setSelectedState,
    selectedLga, setSelectedLga,
    selectedPlace, setSelectedPlace,
    selectedZone,
    pickupAvailable,
    shippingCost,
    pickupAddress,
  };
}
