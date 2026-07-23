/** STOREFRONT layer — a single delivery zone's fee/ETA/pickup summary for the public Shipping page. */
import { MapPin, Store, Phone } from 'lucide-react';
import { formatCurrency } from '@/lib/commerce/pricing';
import { formatZoneEta } from '@/lib/commerce/shipping-eta';
import { formatZoneLocation } from '@/lib/commerce/shipping-match';
import type { ShippingZone } from '@/types/shipping';

interface ShippingZoneCardProps {
  zone: ShippingZone;
}

export default function ShippingZoneCard({ zone }: ShippingZoneCardProps) {
  return (
    <div className="bg-surface border border-border rounded-control p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="font-bold text-body-sm md:text-body-md text-text-primary">{zone.name}</p>
          <p className="flex items-center gap-1 text-caption-md md:text-body-sm text-text-secondary">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{formatZoneLocation(zone)}</span>
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-body-sm md:text-body-md text-text-primary">{formatCurrency(zone.delivery_fee)}</p>
          <p className="text-caption-md md:text-body-sm text-text-secondary">{formatZoneEta(zone)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-border-light text-caption-md md:text-body-sm text-text-secondary">
        {zone.pickup_available ? (
          <span className="flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-success shrink-0" />
            Pickup available{zone.pickup_address ? `: ${zone.pickup_address}` : ''}
          </span>
        ) : (
          <span className="italic text-text-muted">Pickup not offered</span>
        )}
        {zone.contact_phone && (
          <span className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 shrink-0" />
            {zone.contact_phone}
          </span>
        )}
      </div>
    </div>
  );
}
