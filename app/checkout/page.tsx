/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// app/checkout/page.tsx
'use client';

import { useState } from 'react';
import { useCart } from '@/components/CartProvider';
import { calculateTax } from '@/lib/commerce/checkout';
import CheckoutHeader, { type CheckoutStep } from '@/components/checkout/CheckoutHeader';
import EmptyCart from '@/components/checkout/EmptyCart';
import PaymentStep from '@/components/checkout/PaymentStep';
import ConfirmationStep from '@/components/checkout/ConfirmationStep';
import CheckoutFormStep from '@/components/checkout/CheckoutFormStep';
import CheckoutSignInGate from '@/components/checkout/CheckoutSignInGate';
import { useCheckoutForm } from '@/components/checkout/hooks/useCheckoutForm';
import { useCheckoutIdentity } from '@/components/checkout/hooks/useCheckoutIdentity';
import { PrefilledNotice } from '@/components/checkout/PrefilledNotice';
import { useCheckoutFormSubmit } from '@/components/checkout/hooks/useCheckoutFormSubmit';
import { useCheckoutPayment } from '@/components/checkout/hooks/useCheckoutPayment';
import { useCheckoutShipping } from '@/components/checkout/hooks/useCheckoutShipping';
import { useMobileOrderSummaryModal } from '@/components/checkout/hooks/useMobileOrderSummaryModal';
import { useCheckoutFieldErrors } from '@/components/checkout/hooks/useCheckoutFieldErrors';

export default function CheckoutPage() {
  const { items, getTotal, clearCart } = useCart();
  const [step, setStep] = useState<CheckoutStep>('form');
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [orderTotal, setOrderTotal] = useState<number>(0);

  /**
   * One value per checkout attempt, minted here and sent with both the quote
   * and the order. It is what makes order creation idempotent: the flow uploads
   * a receipt and then inserts, so a response lost after a successful insert
   * used to leave the customer retrying into a second order against one
   * payment. Now the retry returns the order that already exists.
   *
   * The lazy initialiser matters — a plain `useState(crypto.randomUUID())`
   * would generate a fresh value on every render.
   */
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());

  // Signed in, straight through with everything prefilled. Signed out, offered
  // the choice — an offer, never a wall: see CheckoutSignInGate.
  const identity = useCheckoutIdentity();

  const { formData, setFormData, prefill } = useCheckoutForm();
  const { fieldErrors, captureFieldErrors, clearFieldErrors } = useCheckoutFieldErrors();
  const {
    zones,
    deliveryOption, setDeliveryOption,
    selectedState, setSelectedState,
    selectedLga, setSelectedLga,
    selectedPlace, setSelectedPlace,
    selectedZone,
    pickupAvailable,
    shippingCost,
    pickupAddress,
  } = useCheckoutShipping();

  const subtotal = getTotal();
  const tax = calculateTax(subtotal);
  const total = subtotal + tax + shippingCost;

  const payment = useCheckoutPayment({
    // From the payment step onwards this is the server-confirmed total the
    // customer was actually asked to pay, not the locally-derived preview.
    total: orderTotal || total,
    orderNumber,
    idempotencyKey,
    items,
    formData,
    deliveryOption,
    selectedState,
    selectedLga,
    selectedPlace,
    onOrdered: () => {
      clearCart();
      setStep('confirmation');
      // A second order in this session is a new attempt and needs its own key,
      // or it would replay straight back into this order.
      setIdempotencyKey(crypto.randomUUID());
    },
    // Rejected fields live on the details step, so go back to it rather than
    // leaving the customer on a payment screen with nothing to fix.
    onValidationError: (body) => {
      const named = captureFieldErrors(body);
      if (named) setStep('form');
      return named;
    },
  });

  const { handleSubmit, isSubmitting } = useCheckoutFormSubmit({
    items,
    deliveryOption,
    selectedState,
    selectedLga,
    selectedPlace,
    selectedZone,
    address: formData.address,
    customerEmail: formData.email,
    idempotencyKey,
    // Both values come from the server: the total from priceOrder(), and the
    // order number from a Postgres sequence. Neither is invented here any more.
    onReady: ({ total: confirmedTotal, orderNumber: issuedNumber }) => {
      setOrderNumber(issuedNumber);
      setOrderTotal(confirmedTotal);
      setStep('payment');
    },
  });

  /** Drops last attempt's highlights, so a corrected form doesn't keep showing
   * errors the customer has already fixed. */
  const handleFormSubmit = (event: React.FormEvent) => {
    clearFieldErrors();
    handleSubmit(event);
  };

  const { open: openMobileOrderSummary, close: closeMobileOrderSummary } = useMobileOrderSummaryModal();

  if (items.length === 0 && step !== 'confirmation') {
    return <EmptyCart />;
  }

  // Only on the details step: once an order number has been issued the choice
  // has been made, and interrupting would strand a customer mid-payment.
  if (step === 'form' && !identity.ready) return <CheckoutSignInGate identity={identity} />;

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
            onOpenMobileOrderSummary={openMobileOrderSummary}
            onCloseMobileOrderSummary={closeMobileOrderSummary}
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
