/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { Home, Store } from 'lucide-react';
import { getDeliveryDescription, isPickupAvailable } from '@/lib/commerce/checkout';
import type { ShippingZone } from '@/types/shipping';

interface DeliveryInfoProps {
  deliveryOption: 'pickup' | 'delivery';
  selectedState: string;
  selectedLga: string;
  selectedPlace: string;
  zones: ShippingZone[];
}

export default function DeliveryInfo({ deliveryOption, selectedState, selectedLga, selectedPlace, zones }: DeliveryInfoProps) {
  const isPickup = deliveryOption === 'pickup' && isPickupAvailable(zones, selectedState, selectedLga, selectedPlace);

  return (
    <div className={`mt-4 sm:mt-6 p-3 sm:p-4 rounded-surface ${
      isPickup
        ? 'bg-primary/10 border border-primary/30'
        : 'bg-surface-inverse border border-surface-inverse'
    }`}>
      <div className="flex items-center">
        {isPickup ? (
          <Store className="w-4 h-4 sm:w-5 sm:h-5 text-primary mr-2" />
        ) : (
          <Home className="w-4 h-4 sm:w-5 sm:h-5 text-on-inverse mr-2" />
        )}
        <h4 className={`font-bold text-body-sm sm:text-body-md ${
          isPickup
            ? 'text-primary'
            : 'text-on-inverse'
        }`}>
          {isPickup
            ? 'Pickup Information:'
            : 'Delivery Information:'
          }
        </h4>
      </div>
      <p className={`text-caption-md sm:text-body-sm mt-1 sm:mt-2 ${
        isPickup
          ? 'text-primary'
          : 'text-on-inverse/80'
      }`}>
        {getDeliveryDescription(deliveryOption, zones, selectedState, { lga: selectedLga, place: selectedPlace }, 'infoPanel')}
      </p>
    </div>
  );
}
