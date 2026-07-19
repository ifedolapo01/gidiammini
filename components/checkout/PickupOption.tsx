/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { Store } from 'lucide-react';

interface PickupOptionProps {
  isPickupAvailable: boolean;
  deliveryOption: 'pickup' | 'delivery';
  setDeliveryOption: (option: 'pickup' | 'delivery') => void;
  pickupAddress: string;
}

export default function PickupOption({ isPickupAvailable, deliveryOption, setDeliveryOption, pickupAddress }: PickupOptionProps) {
  return (
    <button
      type="button"
      onClick={() => isPickupAvailable && setDeliveryOption('pickup')}
      disabled={!isPickupAvailable}
      className={`flex flex-col items-center justify-center p-3 sm:p-4 md:p-6 border-2 rounded-surface transition-all min-w-[140px] sm:min-w-0 sm:min-h-[140px] md:min-h-[180px] w-full flex-shrink-0 sm:flex-shrink ${
        deliveryOption === 'pickup' && isPickupAvailable
          ? 'border-primary bg-primary/10'
          : !isPickupAvailable
          ? 'border-border-strong bg-background-tertiary cursor-not-allowed'
          : 'border-border-strong hover:border-border-strong hover:bg-surface-hover'
      }`}
    >
      <Store className={`w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 mb-1 sm:mb-2 md:mb-3 ${
        deliveryOption === 'pickup' && isPickupAvailable
          ? 'text-primary'
          : 'text-text-secondary'
      }`} />
      <span className="font-bold text-body-sm sm:text-body-md md:text-body-lg text-text-primary">Pickup</span>
      <span className={`mt-0.5 sm:mt-1 md:mt-2 text-caption-md sm:text-body-sm md:text-body-md ${
        deliveryOption === 'pickup' && isPickupAvailable
          ? 'text-primary font-semibold'
          : 'text-text-primary'
      }`}>
        {isPickupAvailable ? 'Free' : 'Not Available'}
      </span>
      <div className="mt-2 sm:mt-3 md:mt-4 text-center">
        <p className="font-medium text-caption-md text-text-primary">Pickup Address:</p>
        <p className="text-text-secondary text-caption-md mt-0.5 line-clamp-2">{pickupAddress}</p>
      </div>
      {!isPickupAvailable && (
        <div className="mt-2 bg-background-tertiary text-text-primary px-1.5 py-0.5 rounded-full text-caption-md">
          Abuja Only
        </div>
      )}
      {deliveryOption === 'pickup' && isPickupAvailable && (
        <div className="mt-2 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-caption-md sm:text-body-sm">
          Selected
        </div>
      )}
    </button>
  );
}
