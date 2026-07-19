/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { Home, Store } from 'lucide-react';
import { getDeliveryDescription } from '@/lib/commerce/checkout';

interface DeliveryInfoProps {
  deliveryOption: 'pickup' | 'delivery';
  isPickupAvailable: boolean;
  selectedState: string;
}

export default function DeliveryInfo({ deliveryOption, isPickupAvailable, selectedState }: DeliveryInfoProps) {
  const isPickup = deliveryOption === 'pickup' && isPickupAvailable;

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
        {getDeliveryDescription(deliveryOption, isPickupAvailable, { selectedState }, 'infoPanel')}
      </p>
    </div>
  );
}
