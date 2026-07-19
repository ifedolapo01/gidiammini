/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { CartItem } from '@/types/order';
import StateDeliveryForm from './StateDeliveryForm';
import CustomerInformation from './CustomerInformation';
import OrderSummary from './OrderSummary';
import MobileOrderSummary from './MobileOrderSummary';

interface CheckoutFormStepProps {
  selectedState: string;
  setSelectedState: (state: string) => void;
  deliveryOption: 'pickup' | 'delivery';
  setDeliveryOption: (option: 'pickup' | 'delivery') => void;
  pickupAddress: string;
  pickupAvailable: boolean;
  formData: any;
  setFormData: (formData: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  items: CartItem[];
  subtotal: number;
  tax: number;
  shippingCost: number;
  total: number;
  onOpenMobileOrderSummary: () => void;
  onCloseMobileOrderSummary: () => void;
}

export default function CheckoutFormStep({
  selectedState,
  setSelectedState,
  deliveryOption,
  setDeliveryOption,
  pickupAddress,
  pickupAvailable,
  formData,
  setFormData,
  onSubmit,
  items,
  subtotal,
  tax,
  shippingCost,
  total,
  onOpenMobileOrderSummary,
  onCloseMobileOrderSummary,
}: CheckoutFormStepProps) {
  return (
    <div className="md:grid md:grid-cols-3 md:gap-6 lg:gap-8">
      {/* Mobile: Single column, Desktop: Two-thirds for form */}
      <div className="md:col-span-2">
        <form onSubmit={onSubmit} id="checkout-form" className="space-y-4 sm:space-y-6 md:space-y-8">
          <StateDeliveryForm
            selectedState={selectedState}
            deliveryOption={deliveryOption}
            setSelectedState={setSelectedState}
            setDeliveryOption={setDeliveryOption}
            pickupAddress={pickupAddress}
          />

          <CustomerInformation
            deliveryOption={deliveryOption}
            isPickupAvailable={pickupAvailable}
            selectedState={selectedState}
            formData={formData}
            setFormData={setFormData}
          />

          {/* Submit Button - Desktop */}
          <button
            type="submit"
            className="hidden md:block w-full bg-primary text-primary-foreground py-3 md:py-4 rounded-control font-semibold text-body-md md:text-body-lg hover:bg-primary-hover transition-all duration-300 shadow-elevation-3 hover:shadow-elevation-4"
          >
            Proceed to Payment
          </button>
        </form>
      </div>

      {/* Order Summary - Mobile: Bottom sticky, Desktop: Sidebar */}
      <div className="mt-4 sm:mt-6 md:mt-0">
        {/* Desktop Order Summary */}
        <div className="hidden md:block sticky top-24">
          <OrderSummary
            items={items}
            subtotal={subtotal}
            tax={tax}
            shippingCost={shippingCost}
            total={total}
            deliveryOption={deliveryOption}
            selectedState={selectedState}
          />
        </div>

        {/* Mobile Bottom Bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t shadow-elevation-3 z-50 p-3 sm:p-4">
          <MobileOrderSummary total={total} onViewDetails={onOpenMobileOrderSummary} />
          <button
            type="submit"
            form="checkout-form"
            className="w-full bg-primary text-primary-foreground py-3 sm:py-4 rounded-control font-semibold text-body-md sm:text-body-lg hover:bg-primary-hover"
          >
            Proceed to Payment
          </button>
        </div>

        {/* Mobile Order Summary Modal */}
        <dialog id="mobile-order-summary" className="modal modal-bottom sm:modal-middle">
          <div className="modal-box max-h-[80vh] overflow-y-auto p-0 w-full max-w-full sm:max-w-md">
            <div className="sticky top-0 bg-surface border-b p-3 sm:p-4">
              <h3 className="text-body-md sm:text-body-lg font-bold">Order Summary</h3>
              <button
                className="absolute right-3 sm:right-4 top-3 sm:top-4 text-body-lg"
                onClick={onCloseMobileOrderSummary}
              >
                ✕
              </button>
            </div>
            <div className="p-3 sm:p-4">
              <OrderSummary
                items={items}
                subtotal={subtotal}
                tax={tax}
                shippingCost={shippingCost}
                total={total}
                deliveryOption={deliveryOption}
                selectedState={selectedState}
              />
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button>close</button>
          </form>
        </dialog>
      </div>
    </div>
  );
}
