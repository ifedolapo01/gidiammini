/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import FormInput from './FormInput';

interface AddressFieldsProps {
  selectedState: string;
  address: string;
  city: string;
  setAddress: (value: string) => void;
  setCity: (value: string) => void;
}

export default function AddressFields({ selectedState, address, city, setAddress, setCity }: AddressFieldsProps) {
  return (
    <div className="mt-3 sm:mt-4 md:mt-6">
      <div className="space-y-3">
        <FormInput
          label={selectedState === 'Abuja' ? 'Delivery Address *' : 'Park Drop-off Address *'}
          value={address}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
          placeholder={selectedState === 'Abuja'
            ? "House number, Street, Area"
            : "Which park should we deliver to?"
          }
        />
        <FormInput
          label="City/Town *"
          value={city}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCity(e.target.value)}
          placeholder="City or town in your state"
        />
      </div>
      {selectedState !== 'Abuja' && (
        <div className="mt-3 p-2 sm:p-3 bg-warning-background border border-warning-border rounded-control">
          <p className="text-caption-md sm:text-body-sm text-warning">
            <strong>Note:</strong> For {selectedState}, we deliver to designated parks only.
            Please specify which park you prefer and you'll need to collect your order from there.
          </p>
        </div>
      )}
    </div>
  );
}
