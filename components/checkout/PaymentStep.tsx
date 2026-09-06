/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { ArrowLeft, MessageCircle } from 'lucide-react';
import { Badge, Spinner } from '@/components/ui';
import { getDeliveryLabel } from '@/lib/commerce/checkout';
import { resolveBankDetails } from '@/lib/commerce/bank-details';
import { useStoreSettings } from '@/components/StoreSettingsProvider';
import type { ShippingZone } from '@/types/shipping';
import type { CheckoutPayment } from './hooks/useCheckoutPayment';
import BankDetails from './BankDetails';
import ReceiptUpload from './ReceiptUpload';
import PaymentMethodChoice from './PaymentMethodChoice';
import OnlinePaymentPanel from './OnlinePaymentPanel';

interface PaymentStepProps {
  orderNumber: string;
  deliveryOption: 'pickup' | 'delivery';
  selectedState: string;
  selectedLga: string;
  selectedPlace: string;
  zones: ShippingZone[];
  total: number;
  setStep: (step: 'form' | 'payment' | 'confirmation') => void;
  /** The whole payment surface: both paths, and which one is selected. */
  payment: CheckoutPayment;
}

export default function PaymentStep({
  orderNumber,
  deliveryOption,
  selectedState,
  selectedLga,
  selectedPlace,
  zones,
  total,
  setStep,
  payment,
}: PaymentStepProps) {
  const {
    uploadedReceipt,
    setUploadedReceipt,
    handleReceiptUpload,
    handleSendReceipt,
    isProcessing,
    paymentMethod,
    setPaymentMethod,
    onlineAvailable,
    isRedirecting,
    handlePayOnline,
  } = payment;

  const storeSettings = useStoreSettings();
  const payingOnline = onlineAvailable && paymentMethod === 'online';

  // The account the shop is actually using today. Was four NEXT_PUBLIC_*
  // reads, which meant changing bank was a redeploy; now the Settings page,
  // falling back to those same env vars until somebody fills it in. See
  // lib/commerce/bank-details.ts.
  const bankDetails = resolveBankDetails(storeSettings);

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      <div className="bg-surface rounded-surface shadow-elevation-2 border border-border p-4 md:p-8 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 md:mb-8">
          <div>
            <h2 className="text-h5 md:text-h4 font-bold text-text-primary">Make Payment</h2>
            <p className="text-text-secondary text-body-sm md:text-body-md">Order #{orderNumber}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`px-3 py-1 rounded-full text-caption-md md:text-body-sm font-medium ${
                deliveryOption === 'pickup' ? 'bg-info-background text-info' : 'bg-surface-inverse text-on-inverse'
              }`}>
                {getDeliveryLabel(deliveryOption, zones, selectedState, 'badge', { lga: selectedLga, place: selectedPlace })} • {selectedState}
              </span>
              <Badge tone="warning">Awaiting Payment</Badge>
            </div>
          </div>
        </div>

        <PaymentMethodChoice
          value={paymentMethod}
          onChange={setPaymentMethod}
          onlineAvailable={onlineAvailable}
        />

        {payingOnline ? (
          <OnlinePaymentPanel total={total} isRedirecting={isRedirecting} onPay={handlePayOnline} />
        ) : (
          <>
            {/* Bank Details */}
            <BankDetails
              bankDetails={bankDetails}
              orderNumber={orderNumber}
              total={total}
            />

            {/* Receipt Upload */}
            <ReceiptUpload
              uploadedReceipt={uploadedReceipt}
              setUploadedReceipt={setUploadedReceipt}
              handleReceiptUpload={handleReceiptUpload}
            />
          </>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Judgment call: kept as a plain tokenized <button> rather than swapping to
              the Button primitive — its responsive py-3/md:py-4 + text-sm/md:text-base
              sizing doesn't map onto Button's fixed size scale, and cn() has no
              tailwind-merge to safely resolve the resulting class conflicts. */}
          <button
            onClick={() => setStep('form')}
            className="flex-1 border border-border-strong text-text-primary py-3 md:py-4 rounded-control font-medium hover:bg-surface-hover transition-colors flex items-center justify-center text-body-sm md:text-body-md"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 mr-2" />
            Edit Order Details
          </button>

          {/* Judgment call: not using Button's `loading` prop — this button swaps to
              different inline status copy ("Sending Receipt...") while loading,
              which the primitive's built-in loading state doesn't support. */}
          {!payingOnline && (
          <button
            onClick={handleSendReceipt}
            disabled={!uploadedReceipt || isProcessing}
            className="flex-1 bg-success text-text-inverse py-3 md:py-4 rounded-control font-semibold md:font-bold text-body-md md:text-body-lg hover:opacity-90 disabled:bg-disabled transition-all flex items-center justify-center"
          >
            {isProcessing ? (
              <>
                <Spinner size="sm" className="text-text-inverse mr-2" />
                <span className="text-body-sm md:text-body-md">Sending Receipt...</span>
              </>
            ) : (
              <>
                <MessageCircle className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                <span className="text-body-sm md:text-body-md">Send Receipt to Us</span>
              </>
            )}
          </button>
          )}
        </div>

        {/* What happens next, on the transfer path. */}
        {!payingOnline && (
        <div className="mt-6 md:mt-8 p-4 bg-success-background border border-success-border rounded-surface">
          <div className="flex items-center">
            <MessageCircle className="w-4 h-4 md:w-5 h-5 text-success mr-2" />
            <h4 className="font-bold text-success text-body-sm md:text-body-md">Automatic Email Notification:</h4>
          </div>
          <p className="text-caption-md md:text-body-sm text-success mt-2">
            When you click "Send Receipt to Us", we'll receive all your order details and the receipt right away.
            We'll verify your payment and contact you via email/SMS for order confirmation.
          </p>
        </div>
        )}
      </div>
    </div>
  );
}
