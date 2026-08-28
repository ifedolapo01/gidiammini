/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// app/checkout/page.tsx
'use client';

import { useState } from 'react';
import { useCart } from '@/components/CartProvider';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { calculateTax } from '@/lib/commerce/checkout';

import CheckoutSteps from '@/components/checkout/CheckoutSteps';
import EmptyCart from '@/components/checkout/EmptyCart';
import PaymentStep from '@/components/checkout/PaymentStep';
import ConfirmationStep from '@/components/checkout/ConfirmationStep';
import CheckoutFormStep from '@/components/checkout/CheckoutFormStep';
import { useCheckoutForm } from '@/components/checkout/hooks/useCheckoutForm';
import { useCheckoutFormSubmit } from '@/components/checkout/hooks/useCheckoutFormSubmit';
import { useOrderSubmission } from '@/components/checkout/hooks/useOrderSubmission';
import { useCheckoutShipping } from '@/components/checkout/hooks/useCheckoutShipping';
import { useMobileOrderSummaryModal } from '@/components/checkout/hooks/useMobileOrderSummaryModal';

export default function CheckoutPage() {
  const { items, getTotal, clearCart } = useCart();
  const [step, setStep] = useState<'form' | 'payment' | 'confirmation'>('form');
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

  const { formData, setFormData } = useCheckoutForm();
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

  const {
    uploadedReceipt,
    setUploadedReceipt,
    isProcessing,
    handleReceiptUpload,
    handleSendReceipt
  } = useOrderSubmission({
    // From the payment step onwards this is the server-confirmed total the
    // customer was actually asked to transfer, not the locally-derived preview.
    total: orderTotal || total,
    orderNumber,
    idempotencyKey,
    items,
    formData,
    deliveryOption,
    selectedState,
    selectedLga,
    selectedPlace,
    onSuccess: () => {
      clearCart();
      setStep('confirmation');
      // A second order in the same session is a new attempt, so it needs its
      // own key — otherwise it would replay straight back into this order.
      setIdempotencyKey(crypto.randomUUID());
    }
  });

  const { handleSubmit, isSubmitting } = useCheckoutFormSubmit({
    items,
    deliveryOption,
    selectedState,
    selectedLga,
    selectedPlace,
    selectedZone,
    address: formData.address,
    idempotencyKey,
    // Both values come from the server: the total from priceOrder(), and the
    // order number from a Postgres sequence. Neither is invented here any more.
    onReady: ({ total: confirmedTotal, orderNumber: issuedNumber }) => {
      setOrderNumber(issuedNumber);
      setOrderTotal(confirmedTotal);
      setStep('payment');
    },
  });

  const { open: openMobileOrderSummary, close: closeMobileOrderSummary } = useMobileOrderSummaryModal();

  if (items.length === 0 && step !== 'confirmation') {
    return <EmptyCart />;
  }

  return (
    <div className="min-h-screen bg-background-secondary overflow-x-hidden">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Return to Cart Header - Mobile optimized */}
        {step === 'form' && (
          <div className="mb-3">
            <Link
              href="/cart"
              className="inline-flex items-center text-primary hover:text-primary-hover font-medium py-1 px-1"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
              <span className="text-caption-md sm:text-body-sm">Return to Cart</span>
            </Link>
          </div>
        )}

        {/* Checkout Steps - Mobile optimized */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <CheckoutSteps step={step} />
        </div>

        {/* Page Title - Mobile responsive. Omitted on the confirmation step,
            since ConfirmationStep already has its own heading — showing both
            reads as two different "your order was submitted" messages. */}
        {step !== 'confirmation' && (
          <div className="mb-3 sm:mb-4 md:mb-6">
            <h1 className="text-body-lg sm:text-h5 md:text-h4 lg:text-h3 font-bold mb-1 text-text-primary">
              {step === 'form' && 'Checkout'}
              {step === 'payment' && 'Make Payment'}
            </h1>

            <p className="text-caption-md sm:text-body-sm text-text-secondary">
              {step === 'form' && 'Complete your purchase'}
              {step === 'payment' && 'Transfer funds and upload receipt'}
            </p>
          </div>
        )}

        {/* STEP 1: Customer Details Form */}
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
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
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
            uploadedReceipt={uploadedReceipt}
            setUploadedReceipt={setUploadedReceipt}
            handleReceiptUpload={handleReceiptUpload}
            isProcessing={isProcessing}
            setStep={setStep}
            handleSendReceipt={handleSendReceipt}
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
