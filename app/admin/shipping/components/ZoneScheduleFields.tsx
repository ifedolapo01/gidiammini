/** ADMIN layer — order cutoff time + working days, turning the zone's
 * (min, max, unit) ETA into the real date shown on the product page, cart,
 * checkout, and confirmation email. See lib/commerce/delivery-promise.ts. */
'use client';

import { Checkbox, Input } from '@/components/ui';
import { computeDeliveryWindow, formatDeliveryWindow } from '@/lib/commerce/delivery-promise';
import type { ShippingZoneFormData } from '../hooks/useShippingZones';

interface ZoneScheduleFieldsProps {
  formData: ShippingZoneFormData;
  setFormData: React.Dispatch<React.SetStateAction<ShippingZoneFormData>>;
}

const WEEKDAYS: { day: number; label: string }[] = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 7, label: 'Sun' },
];

export function ZoneScheduleFields({ formData, setFormData }: ZoneScheduleFieldsProps) {
  const toggleDay = (day: number) => {
    const working = formData.working_days.includes(day)
      ? formData.working_days.filter((d) => d !== day)
      : [...formData.working_days, day].sort();
    // At least one working day, always — a zone that never dispatches isn't
    // a schedule, it's a zone that should be deactivated instead.
    if (working.length > 0) setFormData({ ...formData, working_days: working });
  };

  const min = Number(formData.delivery_eta_min) || 0;

  let preview: string | null = null;
  if (min > 0) {
    const { start, end } = computeDeliveryWindow(new Date(), {
      order_cutoff_time: formData.order_cutoff_time || null,
      working_days: formData.working_days,
      delivery_eta_min: min,
      delivery_eta_max: Number(formData.delivery_eta_max) || min,
      delivery_eta_unit: formData.delivery_eta_unit,
    });
    preview = formatDeliveryWindow(start, end);
  }

  return (
    <div className="space-y-3 pt-2 border-t border-border-light">
      <div>
        <label className="block text-body-sm font-semibold text-text-primary mb-1.5">
          Order Cutoff Time <span className="font-normal text-text-muted text-caption-md">(UTC — leave blank for no cutoff)</span>
        </label>
        <Input
          type="time"
          value={formData.order_cutoff_time}
          onChange={(e) => setFormData({ ...formData, order_cutoff_time: e.target.value })}
          className="max-w-[10rem]"
        />
      </div>

      <div>
        <label className="block text-body-sm font-semibold text-text-primary mb-1.5">Working Days</label>
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.map(({ day, label }) => (
            <div key={day} className="flex items-center gap-1.5">
              <Checkbox
                id={`working-day-${day}`}
                checked={formData.working_days.includes(day)}
                onChange={() => toggleDay(day)}
              />
              <label htmlFor={`working-day-${day}`} className="text-body-sm text-text-primary">
                {label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {preview && (
        <p className="text-caption-md text-text-muted">
          Preview: order placed now would arrive {preview}
        </p>
      )}
    </div>
  );
}
