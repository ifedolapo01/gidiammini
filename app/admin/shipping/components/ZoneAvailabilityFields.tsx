/** ADMIN layer — pickup availability + address/phone sub-fields for the shipping zone form. */
'use client';

import { Checkbox, Input, Textarea } from '@/components/ui';
import type { ShippingZoneFormData } from '../hooks/useShippingZones';

interface ZoneAvailabilityFieldsProps {
  formData: ShippingZoneFormData;
  setFormData: React.Dispatch<React.SetStateAction<ShippingZoneFormData>>;
}

export function ZoneAvailabilityFields({ formData, setFormData }: ZoneAvailabilityFieldsProps) {
  return (
    <div className="space-y-3 pt-2 border-t border-border-light">
      <div className="flex items-center gap-2">
        <Checkbox
          id="pickup_available"
          checked={formData.pickup_available}
          onChange={(e) => setFormData({ ...formData, pickup_available: e.target.checked })}
        />
        <label htmlFor="pickup_available" className="text-body-sm font-medium text-text-primary">
          Offer store pickup in this zone
        </label>
      </div>

      {formData.pickup_available && (
        <div>
          <label className="block text-body-sm font-semibold text-text-primary mb-1.5">Pickup Address</label>
          <Textarea
            value={formData.pickup_address}
            onChange={(e) => setFormData({ ...formData, pickup_address: e.target.value })}
            placeholder="e.g. Suite 5, XYZ Plaza, Central Business District"
            rows={2}
          />
        </div>
      )}

      <div>
        <label className="block text-body-sm font-semibold text-text-primary mb-1.5">
          Contact Phone <span className="font-normal text-text-muted text-caption-md">(Optional)</span>
        </label>
        <Input
          type="tel"
          value={formData.contact_phone}
          onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
          placeholder="e.g. 0809 653 9067"
        />
      </div>
    </div>
  );
}
