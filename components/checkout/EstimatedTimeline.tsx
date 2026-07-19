/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { Truck } from 'lucide-react';
import { getDeliveryLabel } from '@/lib/commerce/checkout';

interface EstimatedTimelineProps {
  deliveryOption: 'pickup' | 'delivery';
  isPickupAvailable: boolean;
  selectedState: string;
}

export default function EstimatedTimeline({ deliveryOption, isPickupAvailable, selectedState }: EstimatedTimelineProps) {
  return (
    <div className="flex items-center bg-background-secondary p-3 md:p-4 rounded-surface mb-6 md:mb-8">
      <Truck className="w-5 h-5 md:w-6 md:h-6 text-info mr-2 md:mr-3" />
      <div>
        <p className="font-medium text-text-primary text-body-sm md:text-body-md">Expected Timeline</p>
        <p className="text-caption-md md:text-body-sm text-text-secondary">
          Payment verification: Within 24 hours<br />
          {getDeliveryLabel(deliveryOption, isPickupAvailable, selectedState, 'arrangementLower')}: 1-2 days after verification
        </p>
      </div>
    </div>
  );
}
