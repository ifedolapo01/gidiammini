/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// The three-step checkout, composed.
//
// Lifted out of app/checkout/page.tsx when the flow gained persistence: the
// page is now a thin Suspense boundary, which useSearchParams needs in a
// statically rendered route, and this is the composition it wraps. The wiring
// behind it is useCheckoutFlow; this file only decides what is on screen.
//
// Where the customer is (`?step=`) and what they have already done (the
// sessionStorage draft) are useCheckoutAttempt's job — see that hook for why
// the URL, not the draft, decides whether a checkout is resumed.
'use client';

import CheckoutHeader from '@/components/checkout/CheckoutHeader';
import EmptyCart from '@/components/checkout/EmptyCart';
import PaymentStep from '@/components/checkout/PaymentStep';
import ConfirmationStep from '@/components/checkout/ConfirmationStep';
import CheckoutFormStep from '@/components/checkout/CheckoutFormStep';
import CheckoutSignInGate from '@/components/checkout/CheckoutSignInGate';
import { PrefilledNotice } from '@/components/checkout/PrefilledNotice';
import { useCheckoutFlow } from '@/components/checkout/hooks/useCheckoutFlow';

export default function CheckoutFlow() {
  const {
    items,
    step,
    setStep,
    identity,
    orderNumber,
    orderTotal,
    formData,
    setFormData,
    prefill,
    fieldErrors,
    shipping,
    subtotal,
    tax,
    total,
    payment,
    handleFormSubmit,
    isSubmitting,
    mobileOrderSummary,
  } = useCheckoutFlow();

  const {
    zones,
    deliveryOption, setDeliveryOption,
    selectedState, setSelectedState,
    selectedLga, setSelectedLga,
    selectedPlace, setSelectedPlace,
    pickupAvailable,
    shippingCost,
    pickupAddress,
  } = shipping;

  if (items.length === 0 && step !== 'confirmation') {
    return <EmptyCart />;
  }

  // Only on the details step, and only before an order number exists: once one
  // has been issued the choice has been made, and interrupting would strand a
  // customer mid-payment. `identity.ready` is per page load, so without the
  // second condition a refresh mid-attempt would ask again — on the way back
  // from the payment screen to correct an address.
  if (step === 'form' && !identity.ready && !orderNumber) {
    return <CheckoutSignInGate identity={identity} />;
  }

  return (
    <div className="min-h-screen bg-background-secondary overflow-x-hidden">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <CheckoutHeader step={step} />

        {/* STEP 1: Customer Details Form */}
        {step === 'form' && <PrefilledNotice email={prefill.email} />}
        {step === 'form' && (
          <CheckoutFormStep
            selectedState={selectedState}
            setSelectedState={setSelectedState}
            selectedLga={selectedLga}
            setSelectedLga={setSelectedLga}
            selectedPlace={selectedPlace}
            setSelectedPlace={setSelectedPlace}
            deliveryOption={deliveryOption}
            setDeliveryOption={setDeliveryOption}
            pickupAddress={pickupAddress}
            pickupAvailable={pickupAvailable}
            zones={zones}
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleFormSubmit}
            isSubmitting={isSubmitting}
            fieldErrors={fieldErrors}
            items={items}
            subtotal={subtotal}
            tax={tax}
            shippingCost={shippingCost}
            total={total}
            onOpenMobileOrderSummary={mobileOrderSummary.open}
            onCloseMobileOrderSummary={mobileOrderSummary.close}
          />
        )}

        {/* STEP 2: Payment Instructions. `orderTotal` is the server-confirmed
            total from the checkout quote — this screen shows the customer the
            amount to transfer, so it must be the figure the server will charge,
            never the locally-derived preview. */}
        {step === 'payment' && (
          <PaymentStep
            orderNumber={orderNumber}
            deliveryOption={deliveryOption}
            selectedState={selectedState}
            selectedLga={selectedLga}
            selectedPlace={selectedPlace}
            zones={zones}
            total={orderTotal || total}
            setStep={setStep}
            payment={payment}
          />
        )}

        {/* STEP 3: Confirmation */}
        {step === 'confirmation' && (
          <ConfirmationStep
            orderNumber={orderNumber}
            deliveryOption={deliveryOption}
            selectedState={selectedState}
            selectedLga={selectedLga}
            selectedPlace={selectedPlace}
            zones={zones}
            formData={formData}
            pickupAddress={pickupAddress}
            total={orderTotal || total}
          />
        )}
      </div>
    </div>
  );
}
