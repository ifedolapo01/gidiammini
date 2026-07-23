/** STOREFRONT layer — fetches and renders the active delivery zones for the public Shipping page. */
'use client';

import { Skeleton } from '@/components/ui';
import { useActiveShippingZones } from '@/components/checkout/hooks/useActiveShippingZones';
import ShippingZoneCard from './ShippingZoneCard';

export default function ShippingZonesList() {
  const { zones, loading } = useActiveShippingZones();

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-control" />
        ))}
      </div>
    );
  }

  if (zones.length === 0) {
    return (
      <p className="text-body-sm text-text-secondary bg-background-secondary rounded-control p-4">
        Delivery zones are being updated. Please check back shortly, or contact us to confirm delivery to your area.
      </p>
    );
  }

  const sorted = [...zones].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-3">
      {sorted.map((zone) => (
        <ShippingZoneCard key={zone.id} zone={zone} />
      ))}
    </div>
  );
}
