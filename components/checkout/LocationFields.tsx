/** STOREFRONT layer — LGA + District/Town selection, only relevant once the
 * customer is actually being delivered to (pickup skips this entirely). */
'use client';

import { getDistrictOptions } from '@/lib/commerce/checkout';
import { NIGERIA_STATES_LGAS } from '@/lib/data/nigeria-states-lgas';
import { Select } from '@/components/ui';
import type { ShippingZone } from '@/types/shipping';

interface LocationFieldsProps {
  selectedState: string;
  selectedLga: string;
  selectedPlace: string;
  onLgaChange: (lga: string) => void;
  onPlaceChange: (place: string) => void;
  zones: ShippingZone[];
}

export default function LocationFields({
  selectedState, selectedLga, selectedPlace, onLgaChange, onPlaceChange, zones
}: LocationFieldsProps) {
  const lgas = NIGERIA_STATES_LGAS[selectedState] || [];
  const districts = getDistrictOptions(zones, selectedState, selectedLga);

  return (
    <>
      <div className="mb-4 sm:mb-6 md:mb-8">
        <label className="block text-body-sm font-medium text-text-primary mb-2 sm:mb-3">
          Local Government Area *
        </label>
        <Select
          value={selectedLga}
          onChange={(e) => onLgaChange(e.target.value)}
          required
        >
          <option value="" disabled>Select your LGA</option>
          {lgas.map((lga) => (
            <option key={lga} value={lga}>{lga}</option>
          ))}
        </Select>
        <p className="text-caption-md sm:text-body-sm text-text-secondary mt-1 sm:mt-2">
          Delivery fee, and estimated time depend on your state and LGA.
        </p>
      </div>

      {/* District/Town - only shown when a more specific rate has been configured for this LGA */}
      {districts.length > 0 && (
        <div className="mb-4 sm:mb-6 md:mb-8">
          <label className="block text-body-sm font-medium text-text-primary mb-2 sm:mb-3">
            District/Town <span className="font-normal text-text-muted">(Optional)</span>
          </label>
          <Select
            value={selectedPlace}
            onChange={(e) => onPlaceChange(e.target.value)}
          >
            <option value="">General {selectedLga} area</option>
            {districts.map((district) => (
              <option key={district} value={district}>{district}</option>
            ))}
          </Select>
          <p className="text-caption-md sm:text-body-sm text-text-secondary mt-1 sm:mt-2">
            Pick your district/town if listed — it may carry its own rate.
          </p>
        </div>
      )}
    </>
  );
}
