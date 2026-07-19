/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// app/checkout/page.tsx
'use client';

import { useState } from 'react';
import { useCart } from '@/components/CartProvider';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { formatCurrency } from '@/lib/commerce/pricing';
import { TAX_RATE, PICKUP_ADDRESS, getDeliveryFee, isPickupAvailable as getIsPickupAvailable } from '@/lib/commerce/checkout';

import CheckoutSteps from '@/components/checkout/CheckoutSteps';
import EmptyCart from '@/components/checkout/EmptyCart';
import PaymentStep from '@/components/checkout/PaymentStep';
import ConfirmationStep from '@/components/checkout/ConfirmationStep';
import CheckoutFormStep from '@/components/checkout/CheckoutFormStep';
import { useCheckoutForm } from '@/components/checkout/hooks/useCheckoutForm';
import { useCheckoutStockValidation } from '@/components/checkout/hooks/useCheckoutStockValidation';
import { useOrderSubmission } from '@/components/checkout/hooks/useOrderSubmission';

export default function CheckoutPage() {
  const { items, getTotal, clearCart } = useCart();
  const [step, setStep] = useState<'form' | 'payment' | 'confirmation'>('form');
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [deliveryOption, setDeliveryOption] = useState<'pickup' | 'delivery'>('pickup');
  const [selectedState, setSelectedState] = useState<string>('Abuja');
  const [orderTotal, setOrderTotal] = useState<number>(0);

  const { formData, setFormData } = useCheckoutForm();
  const { validateStock } = useCheckoutStockValidation();

  const pickupAvailable = getIsPickupAvailable(selectedState);
  const shippingCost = deliveryOption === 'pickup' ? 0 : getDeliveryFee(selectedState);
  const subtotal = getTotal();
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax + shippingCost;

  const {
    uploadedReceipt,
    setUploadedReceipt,
    isProcessing,
    handleReceiptUpload,
    handleSendReceipt
  } = useOrderSubmission({
    orderNumber,
    total,
    items,
    formData,
    deliveryOption,
    selectedState,
    onSuccess: () => {
      clearCart();
      setStep('confirmation');
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (deliveryOption === 'delivery' && !formData.address.trim()) {
      alert('Please enter your delivery address');
      return;
    }

    const isValid = await validateStock(items);
    if (!isValid) return;

    const newOrderNumber = `UT${Date.now().toString().slice(-8)}`;
    setOrderNumber(newOrderNumber);
    setOrderTotal(total);
    setStep('payment');
  };

  const openMobileOrderSummary = () => {
    const modal = document.getElementById('mobile-order-summary');
    if (modal) {
      (modal as any).showModal?.();
    }
  };

  const closeMobileOrderSummary = () => {
    const modal = document.getElementById('mobile-order-summary');
    if (modal) {
      (modal as any).close?.();
    }
  };

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

        {/* Page Title - Mobile responsive */}
        <div className="mb-3 sm:mb-4 md:mb-6">
          <h1 className="text-body-lg sm:text-h5 md:text-h4 lg:text-h3 font-bold mb-1 text-text-primary">
            {step === 'form' && 'Checkout'}
            {step === 'payment' && 'Make Payment'}
            {step === 'confirmation' && 'Order Submitted!'}
          </h1>

          <p className="text-caption-md sm:text-body-sm text-text-secondary">
            {step === 'form' && 'Complete your purchase'}
            {step === 'payment' && 'Transfer funds and upload receipt'}
            {step === 'confirmation' && 'Your order has been submitted'}
          </p>
        </div>

        {/* STEP 1: Customer Details Form */}
        {step === 'form' && (
          <CheckoutFormStep
            selectedState={selectedState}
            setSelectedState={setSelectedState}
            deliveryOption={deliveryOption}
            setDeliveryOption={setDeliveryOption}
            pickupAddress={PICKUP_ADDRESS}
            pickupAvailable={pickupAvailable}
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            items={items}
            subtotal={subtotal}
            tax={tax}
            shippingCost={shippingCost}
            total={total}
            onOpenMobileOrderSummary={openMobileOrderSummary}
            onCloseMobileOrderSummary={closeMobileOrderSummary}
          />
        )}

        {/* STEP 2: Payment Instructions */}
        {step === 'payment' && (
          <PaymentStep
            orderNumber={orderNumber}
            deliveryOption={deliveryOption}
            selectedState={selectedState}
            isPickupAvailable={pickupAvailable}
            total={total}
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
            isPickupAvailable={pickupAvailable}
            selectedState={selectedState}
            formData={formData}
            pickupAddress={PICKUP_ADDRESS}
            total={orderTotal || total}
          />
        )}
      </div>
    </div>
  );
}
