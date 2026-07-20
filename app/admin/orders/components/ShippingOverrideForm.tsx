/** ADMIN layer — lets an admin re-assign an order's shipping zone/method and notify the customer. */
'use client';

import { useState } from 'react';
import { Truck } from 'lucide-react';
import { Button, Select } from '@/components/ui';
import { formatZoneLocation } from '@/lib/commerce/shipping-match';
import type { ShippingZone } from '@/types/shipping';
import type { Order } from '@/types/order';

interface ShippingOverrideFormProps {
  order: Order;
  zones: ShippingZone[];
  isUpdating: boolean;
  onUpdate: (orderId: string, shippingZoneId: string, deliveryOption: 'pickup' | 'delivery') => void;
}

export default function ShippingOverrideForm({ order, zones, isUpdating, onUpdate }: ShippingOverrideFormProps) {
  const [zoneId, setZoneId] = useState(order.shipping_zone_id || '');
  const [deliveryOption, setDeliveryOption] = useState<'pickup' | 'delivery'>(order.delivery_option);

  const selectedZone = zones.find((z) => z.id === zoneId);
  const canPickup = !!selectedZone?.pickup_available;

  const handleZoneChange = (id: string) => {
    setZoneId(id);
    const zone = zones.find((z) => z.id === id);
    if (!zone?.pickup_available && deliveryOption === 'pickup') {
      setDeliveryOption('delivery');
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
        <Truck className="w-4 h-4" />
        Shipping Method
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-body-sm font-medium text-text-primary mb-1.5">Zone</label>
          <Select value={zoneId} onChange={(e) => handleZoneChange(e.target.value)}>
            <option value="" disabled>Select a zone</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>{zone.name} ({formatZoneLocation(zone)})</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-body-sm font-medium text-text-primary mb-1.5">Method</label>
          <Select
            value={deliveryOption}
            onChange={(e) => setDeliveryOption(e.target.value as 'pickup' | 'delivery')}
          >
            <option value="delivery">Delivery</option>
            <option value="pickup" disabled={!canPickup}>Pickup{!canPickup ? ' (not offered)' : ''}</option>
          </Select>
        </div>
      </div>
      <Button
        className="mt-3"
        disabled={!zoneId || isUpdating}
        loading={isUpdating}
        onClick={() => onUpdate(order.id, zoneId, deliveryOption)}
      >
        Save &amp; Notify Customer
      </Button>
    </div>
  );
}
