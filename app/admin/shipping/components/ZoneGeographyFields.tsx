/** ADMIN layer — State -> LGA -> District/Town scoping for the shipping zone form. */
'use client';

import { Select, Textarea } from '@/components/ui';
import { NIGERIA_STATES_LGAS, NIGERIA_STATE_NAMES } from '@/lib/data/nigeria-states-lgas';
import type { ShippingZoneFormData } from '../hooks/useShippingZones';

const SORTED_STATES = [...NIGERIA_STATE_NAMES].sort();

interface ZoneGeographyFieldsProps {
  formData: ShippingZoneFormData;
  setFormData: React.Dispatch<React.SetStateAction<ShippingZoneFormData>>;
}

export function ZoneGeographyFields({ formData, setFormData }: ZoneGeographyFieldsProps) {
  const lgas = NIGERIA_STATES_LGAS[formData.state] || [];

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-body-sm font-semibold text-text-primary mb-1.5">State</label>
        <Select
          value={formData.state}
          onChange={(e) => setFormData({ ...formData, state: e.target.value, lga: '', places: '' })}
        >
          {SORTED_STATES.map((state) => (
            <option key={state} value={state}>{state}</option>
          ))}
        </Select>
      </div>
      <div>
        <label className="block text-body-sm font-semibold text-text-primary mb-1.5">LGA</label>
        <Select
          value={formData.lga}
          onChange={(e) => setFormData({ ...formData, lga: e.target.value, places: '' })}
        >
          <option value="">All LGAs (whole state)</option>
          {lgas.map((lga) => (
            <option key={lga} value={lga}>{lga}</option>
          ))}
        </Select>
      </div>

      {formData.lga && (
        <div className="col-span-2">
          <label className="block text-body-sm font-semibold text-text-primary mb-1.5">
            Specific districts/towns <span className="font-normal text-text-muted text-caption-md">(optional, one per line)</span>
          </label>
          <Textarea
            value={formData.places}
            onChange={(e) => setFormData({ ...formData, places: e.target.value })}
            placeholder={`e.g.\nWuse\nGarki\nMaitama`}
            rows={3}
          />
          <p className="text-caption-md text-text-muted mt-1">
            Leave blank to cover the whole {formData.lga} LGA. Each district/town listed here appears as its own option in the customer's checkout dropdown.
          </p>
        </div>
      )}
    </div>
  );
}
