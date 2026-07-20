/** ADMIN layer — delivery label + structured (min, max, unit) ETA fields. */
'use client';

import { Checkbox, Input, Select } from '@/components/ui';
import { formatEtaRange } from '@/lib/commerce/shipping-eta';
import type { ShippingZoneFormData } from '../hooks/useShippingZones';

interface ZoneEtaFieldsProps {
  formData: ShippingZoneFormData;
  setFormData: React.Dispatch<React.SetStateAction<ShippingZoneFormData>>;
}

export function ZoneEtaFields({ formData, setFormData }: ZoneEtaFieldsProps) {
  const min = Number(formData.delivery_eta_min) || 0;
  const max = Number(formData.delivery_eta_max) || min;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-body-sm font-semibold text-text-primary mb-1.5">Delivery Label</label>
        <Input
          type="text"
          value={formData.delivery_label}
          onChange={(e) => setFormData({ ...formData, delivery_label: e.target.value })}
          placeholder="e.g. Doorstep Delivery"
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="is_door_delivery"
          checked={formData.is_door_delivery}
          onChange={(e) => setFormData({ ...formData, is_door_delivery: e.target.checked })}
        />
        <label htmlFor="is_door_delivery" className="text-body-sm font-medium text-text-primary">
          Doorstep delivery <span className="text-text-muted font-normal">(customer provides a street address — uncheck for a park/hub drop-off, which needs no address)</span>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-body-sm font-semibold text-text-primary mb-1.5">ETA Min</label>
          <Input
            type="number" onFocus={(e) => e.target.select()}
            value={formData.delivery_eta_min}
            onChange={(e) => setFormData({ ...formData, delivery_eta_min: e.target.value })}
            placeholder="e.g. 3"
            min="0"
            required
          />
        </div>
        <div>
          <label className="block text-body-sm font-semibold text-text-primary mb-1.5">ETA Max</label>
          <Input
            type="number" onFocus={(e) => e.target.select()}
            value={formData.delivery_eta_max}
            onChange={(e) => setFormData({ ...formData, delivery_eta_max: e.target.value })}
            placeholder="e.g. 5"
            min="0"
          />
        </div>
        <div>
          <label className="block text-body-sm font-semibold text-text-primary mb-1.5">Unit</label>
          <Select
            value={formData.delivery_eta_unit}
            onChange={(e) => setFormData({ ...formData, delivery_eta_unit: e.target.value as ShippingZoneFormData['delivery_eta_unit'] })}
          >
            <option value="days">Days</option>
            <option value="weeks">Weeks</option>
            <option value="months">Months</option>
          </Select>
        </div>
      </div>

      {min > 0 && (
        <p className="text-caption-md text-text-muted">
          Preview: {formatEtaRange(min, max, formData.delivery_eta_unit)}
        </p>
      )}
    </div>
  );
}
