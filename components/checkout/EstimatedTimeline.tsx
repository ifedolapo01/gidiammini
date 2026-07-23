/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { Clock, Truck, ArrowRight } from 'lucide-react';
import { getDeliveryLabel, findShippingZone } from '@/lib/commerce/checkout';
import { formatZoneEta } from '@/lib/commerce/shipping-eta';
import type { ShippingZone } from '@/types/shipping';

interface EstimatedTimelineProps {
  deliveryOption: 'pickup' | 'delivery';
  selectedState: string;
  selectedLga: string;
  selectedPlace: string;
  zones: ShippingZone[];
}

export default function EstimatedTimeline({ deliveryOption, selectedState, selectedLga, selectedPlace, zones }: EstimatedTimelineProps) {
  const arrangementLabel = getDeliveryLabel(deliveryOption, zones, selectedState, 'arrangementLower', { lga: selectedLga, place: selectedPlace });
  const zone = findShippingZone(zones, selectedState, selectedLga, selectedPlace);
  const isPickup = deliveryOption === 'pickup' && zone?.pickup_available;
  const arrangementDuration = isPickup ? "We'll notify you" : zone ? formatZoneEta(zone) : 'Varies by location';

  return (
    <div className="bg-background-secondary rounded-surface p-4 md:p-6 mb-6 md:mb-8">
      <p className="font-bold text-body-sm md:text-body-md text-text-primary mb-3 md:mb-4">Expected Timeline</p>
      <div className="flex items-stretch gap-2 sm:gap-3 md:gap-4">
        <TimelineStep icon={<Clock className="w-5 h-5 md:w-6 md:h-6" />} label="Payment Verification" duration="Within 24 hours" />
        <div className="flex items-center shrink-0">
          <ArrowRight className="w-4 h-4 md:w-5 md:h-5 text-text-muted" />
        </div>
        <TimelineStep icon={<Truck className="w-5 h-5 md:w-6 md:h-6" />} label={arrangementLabel} duration={arrangementDuration} />
      </div>
    </div>
  );
}

function TimelineStep({ icon, label, duration }: { icon: React.ReactNode; label: string; duration: string }) {
  return (
    <div className="flex-1 min-w-0 bg-surface border border-border rounded-control p-3 md:p-4 flex flex-col items-center text-center gap-1">
      <div className="text-info">{icon}</div>
      <p className="font-semibold text-caption-md md:text-body-sm text-text-primary capitalize">{label}</p>
      <p className="text-caption-md md:text-body-sm text-text-secondary">{duration}</p>
    </div>
  );
}
