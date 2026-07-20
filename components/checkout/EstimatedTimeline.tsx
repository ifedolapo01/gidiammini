/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { Truck } from 'lucide-react';
import { getDeliveryLabel } from '@/lib/commerce/checkout';
import type { ShippingZone } from '@/types/shipping';

interface EstimatedTimelineProps {
  deliveryOption: 'pickup' | 'delivery';
  selectedState: string;
  selectedLga: string;
  selectedPlace: string;
  zones: ShippingZone[];
}

export default function EstimatedTimeline({ deliveryOption, selectedState, selectedLga, selectedPlace, zones }: EstimatedTimelineProps) {
  return (
    <div className="flex items-center bg-background-secondary p-3 md:p-4 rounded-surface mb-6 md:mb-8">
      <Truck className="w-5 h-5 md:w-6 md:h-6 text-info mr-2 md:mr-3" />
      <div>
        <p className="font-medium text-text-primary text-body-sm md:text-body-md">Expected Timeline</p>
        <p className="text-caption-md md:text-body-sm text-text-secondary">
          Payment verification: Within 24 hours<br />
          {getDeliveryLabel(deliveryOption, zones, selectedState, 'arrangementLower', { lga: selectedLga, place: selectedPlace })}: 1-2 days after verification
        </p>
      </div>
    </div>
  );
}
