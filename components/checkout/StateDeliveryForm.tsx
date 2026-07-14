/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { Home, Store } from 'lucide-react';
import { formatCurrency } from '@/lib/commerce/pricing';
import { Select } from '@/components/ui';

interface StateDeliveryFormProps {
  selectedState: string;
  deliveryOption: 'pickup' | 'delivery';
  setSelectedState: (state: string) => void;
  setDeliveryOption: (option: 'pickup' | 'delivery') => void;
  pickupAddress: string;
}

export default function StateDeliveryForm({
  selectedState,
  deliveryOption,
  setSelectedState,
  setDeliveryOption,
  pickupAddress
}: StateDeliveryFormProps) {

  const getDeliveryFee = (state: string): number => {
    return state === 'Abuja' ? 3000 : 5000;
  };

  const isPickupAvailable = selectedState === 'Abuja';

  const handleStateChange = (state: string) => {
    setSelectedState(state);
    if (state !== 'Abuja' && deliveryOption === 'pickup') {
      setDeliveryOption('delivery');
    }
  };

  return (
    <div className="bg-surface p-3 sm:p-4 md:p-6 rounded-surface shadow-elevation-1 border border-border">
      <h2 className="text-body-md sm:text-body-lg md:text-h5 font-bold mb-3 sm:mb-4 md:mb-6 text-text-primary">Delivery Method</h2>

      {/* State Selection */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <label className="block text-body-sm font-medium text-text-primary mb-2 sm:mb-3">
          Select Your State *
        </label>
        <Select
          value={selectedState}
          onChange={(e) => handleStateChange(e.target.value)}
          required
        >
          <option value="Abuja">Abuja (₦3,000 delivery / Free pickup)</option>
          <option value="Lagos">Lagos (₦5,000 delivery)</option>
          <option value="Rivers">Rivers (₦5,000 delivery)</option>
          <option value="Kano">Kano (₦5,000 delivery)</option>
          <option value="Oyo">Oyo (₦5,000 delivery)</option>
          <option value="Other">Other States (₦5,000 delivery)</option>
        </Select>
        <p className="text-caption-md sm:text-body-sm text-text-secondary mt-1 sm:mt-2">
          Pickup is only available in Abuja. Delivery to other states is to designated parks.
        </p>
      </div>

      {/* Delivery Option Selection - Horizontal on mobile, grid on desktop */}
      <div className="flex sm:grid sm:grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6 overflow-x-auto pb-2 -mx-3 sm:mx-0 px-3 sm:px-0">
        {/* Pickup Option */}
        <PickupOption
          isPickupAvailable={isPickupAvailable}
          deliveryOption={deliveryOption}
          setDeliveryOption={setDeliveryOption}
          pickupAddress={pickupAddress}
        />

        {/* Delivery Option */}
        <DeliveryOption
          deliveryOption={deliveryOption}
          setDeliveryOption={setDeliveryOption}
          selectedState={selectedState}
          getDeliveryFee={getDeliveryFee}
        />
      </div>

      {/* Additional Info */}
      <DeliveryInfo
        deliveryOption={deliveryOption}
        isPickupAvailable={isPickupAvailable}
        selectedState={selectedState}
      />
    </div>
  );
}

function PickupOption({ isPickupAvailable, deliveryOption, setDeliveryOption, pickupAddress }: any) {
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

function DeliveryOption({ deliveryOption, setDeliveryOption, selectedState, getDeliveryFee }: any) {
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

function DeliveryInfo({ deliveryOption, isPickupAvailable, selectedState }: any) {
  return (
    <div className={`mt-4 sm:mt-6 p-3 sm:p-4 rounded-surface ${
      deliveryOption === 'pickup' && isPickupAvailable
        ? 'bg-primary/10 border border-primary/30'
        : 'bg-surface-inverse border border-surface-inverse'
    }`}>
      <div className="flex items-center">
        {deliveryOption === 'pickup' && isPickupAvailable ? (
          <Store className="w-4 h-4 sm:w-5 sm:h-5 text-primary mr-2" />
        ) : (
          <Home className="w-4 h-4 sm:w-5 sm:h-5 text-on-inverse mr-2" />
        )}
        <h4 className={`font-bold text-body-sm sm:text-body-md ${
          deliveryOption === 'pickup' && isPickupAvailable
            ? 'text-primary'
            : 'text-on-inverse'
        }`}>
          {deliveryOption === 'pickup' && isPickupAvailable
            ? 'Pickup Information:'
            : 'Delivery Information:'
          }
        </h4>
      </div>
      <p className={`text-caption-md sm:text-body-sm mt-1 sm:mt-2 ${
        deliveryOption === 'pickup' && isPickupAvailable
          ? 'text-primary'
          : 'text-on-inverse/80'
      }`}>
        {deliveryOption === 'pickup' && isPickupAvailable
          ? `Collect your order from our store in ${selectedState}. We'll contact you when your order is ready for pickup.`
          : selectedState === 'Abuja'
          ? `Your order will be delivered to your address in ${selectedState}. Please ensure someone is available to receive it.`
          : `Your order will be delivered to a designated park in ${selectedState}. You'll need to collect it from the park. We'll provide park details after payment verification.`
        }
      </p>
    </div>
  );
}
