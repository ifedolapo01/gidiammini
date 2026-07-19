/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { isPickupAvailable } from '@/lib/commerce/checkout';
import { Select } from '@/components/ui';
import PickupOption from './PickupOption';
import DeliveryOption from './DeliveryOption';
import DeliveryInfo from './DeliveryInfo';

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

  const pickupAvailable = isPickupAvailable(selectedState);

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
          isPickupAvailable={pickupAvailable}
          deliveryOption={deliveryOption}
          setDeliveryOption={setDeliveryOption}
          pickupAddress={pickupAddress}
        />

        {/* Delivery Option */}
        <DeliveryOption
          deliveryOption={deliveryOption}
          setDeliveryOption={setDeliveryOption}
          selectedState={selectedState}
        />
      </div>

      {/* Additional Info */}
      <DeliveryInfo
        deliveryOption={deliveryOption}
        isPickupAvailable={pickupAvailable}
        selectedState={selectedState}
      />
    </div>
  );
}
