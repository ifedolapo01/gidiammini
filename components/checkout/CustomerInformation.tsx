/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { Checkbox } from '@/components/ui';
import { CheckoutFormData } from './hooks/useCheckoutForm';
import FormInput from './FormInput';
import AddressFields from './AddressFields';

interface CustomerInformationProps {
  deliveryOption: 'pickup' | 'delivery';
  isPickupAvailable: boolean;
  selectedState: string;
  formData: CheckoutFormData;
  setFormData: (formData: CheckoutFormData) => void;
}

export default function CustomerInformation({
  deliveryOption,
  isPickupAvailable,
  selectedState,
  formData,
  setFormData
}: CustomerInformationProps) {
  return (
    <div className="bg-surface p-3 sm:p-4 md:p-6 rounded-surface shadow-elevation-1 border border-border">
      <h2 className="text-body-md sm:text-body-lg md:text-h5 font-bold mb-3 sm:mb-4 md:mb-6 text-text-primary">
        {deliveryOption === 'pickup' && isPickupAvailable
          ? 'Pickup Information'
          : 'Delivery Information'
        }
      </h2>

      <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3 md:gap-4">
        <FormInput
          label="First Name *"
          value={formData.firstName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, firstName: e.target.value })}
          placeholder="First Name"
        />
        <FormInput
          label="Last Name *"
          value={formData.lastName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, lastName: e.target.value })}
          placeholder="Last Name"
        />
      </div>

      <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3 md:gap-4 mt-3 sm:mt-4">
        <FormInput
          type="email"
          label="Email *"
          value={formData.email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
          placeholder="your@email.com"
        />
        <FormInput
          type="tel"
          label="Phone Number *"
          value={formData.phone}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="Phone Number"
        />
      </div>

      <div className="mt-4 flex items-start">
        <div className="flex items-center h-5">
          <Checkbox
            id="subscribe"
            name="subscribe"
            checked={formData.subscribeToNewsletter}
            onChange={(e) => setFormData({ ...formData, subscribeToNewsletter: e.target.checked })}
          />
        </div>
        <div className="ml-3 text-body-sm">
          <label htmlFor="subscribe" className="font-medium text-text-primary">Keep me updated</label>
          <p className="text-text-secondary">Send me exclusive offers and upcoming discounts.</p>
        </div>
      </div>

      {deliveryOption === 'delivery' && (
        <AddressFields
          selectedState={selectedState}
          address={formData.address}
          city={formData.city}
          setAddress={(value: string) => setFormData({ ...formData, address: value })}
          setCity={(value: string) => setFormData({ ...formData, city: value })}
        />
      )}

      <div className="mt-3 sm:mt-4 md:mt-6">
        <label className="block text-body-sm font-medium text-text-primary mb-1">
          Additional Note (Optional)
        </label>
        <textarea
          value={formData.note}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, note: e.target.value })}
          placeholder="Any special instructions or notes for your order..."
          className="w-full border border-border-strong bg-surface text-text-primary rounded-control px-3 sm:px-4 py-2 sm:py-3 h-24 sm:h-32 text-body-sm focus-visible:border-focus"
          rows={3}
        />
      </div>
    </div>
  );
}
