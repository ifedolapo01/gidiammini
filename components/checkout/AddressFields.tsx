/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { findShippingZone } from '@/lib/commerce/checkout';
import { formatZoneEta } from '@/lib/commerce/shipping-eta';
import type { ShippingZone } from '@/types/shipping';
import type { FieldErrors } from '@/lib/api/field-errors';
import FormInput from './FormInput';

interface AddressFieldsProps {
  selectedState: string;
  selectedLga: string;
  selectedPlace: string;
  zones: ShippingZone[];
  address: string;
  city: string;
  setAddress: (value: string) => void;
  setCity: (value: string) => void;
  /** Per-field messages from the server, keyed by form field name. */
  fieldErrors?: FieldErrors;
}

export default function AddressFields({
  selectedState, selectedLga, selectedPlace, zones, address, city, setAddress, setCity,
  fieldErrors = {},
}: AddressFieldsProps) {
  const zone = findShippingZone(zones, selectedState, selectedLga, selectedPlace);
  const deliveryLabel = zone?.delivery_label || 'Delivery';

  return (
    <div className="mt-3 sm:mt-4 md:mt-6">
      <div className="space-y-3">
        <FormInput
          label={`${deliveryLabel} Address *`}
          name="address"
          value={address}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
          placeholder="House number, street, area, or drop-off point"
          error={fieldErrors.address}
        />
        <FormInput
          label="City/Town *"
          name="city"
          value={city}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCity(e.target.value)}
          placeholder="City or town in your state"
          error={fieldErrors.city}
        />
      </div>
      {zone && (
        <div className="mt-3 p-2 sm:p-3 bg-warning-background border border-warning-border rounded-control">
          <p className="text-caption-md sm:text-body-sm text-warning">
            <strong>{deliveryLabel} to {selectedState}:</strong> Estimated {formatZoneEta(zone)}.
          </p>
        </div>
      )}
    </div>
  );
}
