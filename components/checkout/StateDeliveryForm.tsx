/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { isPickupAvailable, getAvailableStates } from '@/lib/commerce/checkout';
import { Select } from '@/components/ui';
import type { ShippingZone } from '@/types/shipping';
import PickupOption from './PickupOption';
import DeliveryOption from './DeliveryOption';
import DeliveryInfo from './DeliveryInfo';
import LocationFields from './LocationFields';

interface StateDeliveryFormProps {
  selectedState: string;
  selectedLga: string;
  selectedPlace: string;
  /** Zones still loading. The state list is derived from them, so until they
   *  land there is nothing to choose. */
  zonesLoading?: boolean;
  deliveryOption: 'pickup' | 'delivery';
  setSelectedState: (state: string) => void;
  setSelectedLga: (lga: string) => void;
  setSelectedPlace: (place: string) => void;
  setDeliveryOption: (option: 'pickup' | 'delivery') => void;
  pickupAddress: string;
  zones: ShippingZone[];
}

export default function StateDeliveryForm({
  selectedState,
  selectedLga,
  selectedPlace,
  zonesLoading = false,
  deliveryOption,
  setSelectedState,
  setSelectedLga,
  setSelectedPlace,
  setDeliveryOption,
  pickupAddress,
  zones
}: StateDeliveryFormProps) {

  const availableStates = getAvailableStates(zones);
  // Pickup is a state-level offering (one physical store), decided before LGA
  // ever comes into it — LGA/district selection only matters once delivering.
  const stateHasPickup = isPickupAvailable(zones, selectedState);

  const handleStateChange = (state: string) => {
    setSelectedState(state);
    setSelectedLga('');
    setSelectedPlace('');
    if (!isPickupAvailable(zones, state) && deliveryOption === 'pickup') {
      setDeliveryOption('delivery');
    }
  };

  const handleDeliveryOptionChange = (option: 'pickup' | 'delivery') => {
    setDeliveryOption(option);
    if (option === 'pickup') {
      setSelectedLga('');
      setSelectedPlace('');
    }
  };

  const handleLgaChange = (lga: string) => {
    setSelectedLga(lga);
    setSelectedPlace('');
  };

  return (
    <div className="bg-surface p-3 sm:p-4 md:p-6 rounded-surface shadow-elevation-1 border border-border">
      <h2 className="text-body-md sm:text-body-lg md:text-h5 font-bold mb-3 sm:mb-4 md:mb-6 text-text-primary">Delivery Method</h2>

      {/* State Selection - only states the admin actually ships to */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <label className="block text-body-sm font-medium text-text-primary mb-2 sm:mb-3">
          Select Your State *
        </label>
        <Select
          value={selectedState}
          onChange={(e) => handleStateChange(e.target.value)}
          disabled={zonesLoading || availableStates.length === 0}
          required
        >
          {availableStates.map((state) => (
            <option key={state} value={state}>{state}</option>
          ))}
        </Select>

        {/* An empty required select cannot be satisfied, and the browser
            refuses the submit without saying why — so say why here. */}
        {zonesLoading && (
          <p className="mt-2 text-caption-md text-text-secondary">
            Loading the places we deliver to…
          </p>
        )}
        {!zonesLoading && availableStates.length === 0 && (
          <p role="alert" className="mt-2 text-caption-md text-destructive">
            We could not load our delivery areas. Please refresh the page, or
            contact us and we will take the order by hand.
          </p>
        )}
      </div>

      {/* Pickup vs Delivery - asked up front (before LGA), so picking pickup can skip it entirely */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <label className="block text-body-sm font-medium text-text-primary mb-2 sm:mb-3">
          How would you like to receive your order? *
        </label>
        <div className={`grid gap-3 sm:gap-4 md:gap-6 ${stateHasPickup ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
          {stateHasPickup && (
            <PickupOption
              deliveryOption={deliveryOption}
              setDeliveryOption={handleDeliveryOptionChange}
              pickupAddress={pickupAddress}
            />
          )}
          <DeliveryOption
            deliveryOption={deliveryOption}
            setDeliveryOption={handleDeliveryOptionChange}
            selectedState={selectedState}
            selectedLga={selectedLga}
            selectedPlace={selectedPlace}
            zones={zones}
          />
        </div>
      </div>

      {/* LGA/District - skipped entirely for pickup, since there's nothing to deliver to */}
      {deliveryOption === 'delivery' && (
        <LocationFields
          selectedState={selectedState}
          selectedLga={selectedLga}
          selectedPlace={selectedPlace}
          onLgaChange={handleLgaChange}
          onPlaceChange={setSelectedPlace}
          zones={zones}
        />
      )}

      {/* Additional Info */}
      <DeliveryInfo
        deliveryOption={deliveryOption}
        selectedState={selectedState}
        selectedLga={selectedLga}
        selectedPlace={selectedPlace}
        zones={zones}
      />
    </div>
  );
}
