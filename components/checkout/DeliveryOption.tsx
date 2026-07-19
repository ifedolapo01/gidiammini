/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { Home } from 'lucide-react';
import { formatCurrency } from '@/lib/commerce/pricing';
import { getDeliveryFee } from '@/lib/commerce/checkout';

interface DeliveryOptionProps {
  deliveryOption: 'pickup' | 'delivery';
  setDeliveryOption: (option: 'pickup' | 'delivery') => void;
  selectedState: string;
}

export default function DeliveryOption({ deliveryOption, setDeliveryOption, selectedState }: DeliveryOptionProps) {
  return (
    <button
      type="button"
      onClick={() => setDeliveryOption('delivery')}
      className={`flex flex-col items-center justify-center p-3 sm:p-4 md:p-6 border-2 rounded-surface transition-all min-w-[140px] sm:min-w-0 sm:min-h-[140px] md:min-h-[180px] w-full flex-shrink-0 sm:flex-shrink ${
        deliveryOption === 'delivery'
          ? 'border-primary bg-surface-inverse'
          : 'border-border-strong hover:border-border-strong hover:bg-surface-hover'
      }`}
    >
      <Home className={`w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 mb-1 sm:mb-2 md:mb-3 ${
        deliveryOption === 'delivery'
          ? 'text-on-inverse'
          : 'text-text-primary'
      }`} />
      <span className={`font-bold text-body-sm sm:text-body-md md:text-body-lg ${
        deliveryOption === 'delivery' ? 'text-on-inverse' : 'text-text-primary'
      }`}>
        Delivery
      </span>
      <span className={`mt-0.5 sm:mt-1 md:mt-2 text-caption-md sm:text-body-sm md:text-body-md font-semibold ${
        deliveryOption === 'delivery'
          ? 'text-on-inverse'
          : 'text-text-primary'
      }`}>
        {formatCurrency(getDeliveryFee(selectedState))}
      </span>
      <div className="mt-2 sm:mt-3 md:mt-4 text-center">
        <p className={`font-medium text-caption-md ${
          deliveryOption === 'delivery' ? 'text-on-inverse/80' : 'text-text-primary'
        }`}>
          {selectedState === 'Abuja'
            ? 'Door-to-door'
            : 'Park drop-off'
          }
        </p>
        <p className={`text-caption-md mt-0.5 ${
          deliveryOption === 'delivery' ? 'text-on-inverse/70' : 'text-text-secondary'
        }`}>
          {selectedState === 'Abuja'
            ? '3-5 days'
            : 'Park pickup'
          }
        </p>
      </div>
      {deliveryOption === 'delivery' && (
        <div className="mt-2 bg-surface text-primary px-2 py-0.5 rounded-full text-caption-md sm:text-body-sm">
          Selected
        </div>
      )}
    </button>
  );
}
