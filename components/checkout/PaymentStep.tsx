/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { Banknote, ArrowLeft, Upload, MessageCircle } from 'lucide-react';
import { Badge, Button, Spinner } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';

interface PaymentStepProps {
  orderNumber: string;
  deliveryOption: 'pickup' | 'delivery';
  selectedState: string;
  isPickupAvailable: boolean;
  total: number;
  uploadedReceipt: string | null;
  setUploadedReceipt: (receipt: string | null) => void;
  handleReceiptUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isProcessing: boolean;
  setStep: (step: 'form' | 'payment' | 'confirmation') => void;
  handleSendReceipt: () => void;
}

export default function PaymentStep({
  orderNumber,
  deliveryOption,
  selectedState,
  isPickupAvailable,
  total,
  uploadedReceipt,
  setUploadedReceipt,
  handleReceiptUpload,
  isProcessing,
  setStep,
  handleSendReceipt
}: PaymentStepProps) {

  const bankDetails = {
    bankName: process.env.NEXT_PUBLIC_BANK_NAME || 'OPAY',
    accountName: process.env.NEXT_PUBLIC_ACCOUNT_NAME || 'Ifedolapo Ajayi',
    accountNumber: process.env.NEXT_PUBLIC_ACCOUNT_NUMBER || '8096539067',
    sortCode: process.env.NEXT_PUBLIC_SORT_CODE || '011'
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      <div className="bg-surface rounded-surface shadow-elevation-2 border border-border p-4 md:p-8 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 md:mb-8">
          <div>
            <h2 className="text-h5 md:text-h4 font-bold text-text-primary">Make Payment</h2>
            <p className="text-text-secondary text-body-sm md:text-body-md">Order #{orderNumber}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`px-3 py-1 rounded-full text-caption-md md:text-body-sm font-medium ${
                deliveryOption === 'pickup' ? 'bg-info-background text-info' : 'bg-text-primary text-text-inverse'
              }`}>
                {deliveryOption === 'pickup'
                  ? 'Pickup (Abuja Only)'
                  : selectedState === 'Abuja'
                  ? 'Delivery (Abuja)'
                  : 'Park Drop-off'
                } • {selectedState}
              </span>
              <Badge tone="warning">Awaiting Payment</Badge>
            </div>
          </div>
        </div>

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
              different inline status copy ("Sending to Store Owner...") while loading,
              which the primitive's built-in loading state doesn't support. */}
          <button
            onClick={handleSendReceipt}
            disabled={!uploadedReceipt || isProcessing}
            className="flex-1 bg-success text-text-inverse py-3 md:py-4 rounded-control font-semibold md:font-bold text-body-md md:text-body-lg hover:opacity-90 disabled:bg-disabled transition-all flex items-center justify-center"
          >
            {isProcessing ? (
              <>
                <Spinner size="sm" className="text-text-inverse mr-2" />
                <span className="text-body-sm md:text-body-md">Sending to Store Owner...</span>
              </>
            ) : (
              <>
                <MessageCircle className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                <span className="text-body-sm md:text-body-md">Send Receipt to Seller</span>
              </>
            )}
          </button>
        </div>

        {/* WhatsApp Note */}
        <div className="mt-6 md:mt-8 p-4 bg-success-background border border-success-border rounded-surface">
          <div className="flex items-center">
            <MessageCircle className="w-4 h-4 md:w-5 h-5 text-success mr-2" />
            <h4 className="font-bold text-success text-body-sm md:text-body-md">Automatic Email Notification:</h4>
          </div>
          <p className="text-caption-md md:text-body-sm text-success mt-2">
            When you click "Send Receipt to Owner", all your order details and the receipt will be automatically
            sent to the store owner's email. They will verify your payment and contact you via email/SMS
            for order confirmation.
          </p>
        </div>
      </div>
    </div>
  );
}

function BankDetails({ bankDetails, orderNumber, total }: any) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="bg-info-background border border-info-border rounded-surface p-4 md:p-6 mb-6 md:mb-8">
      <div className="flex items-center mb-4">
        <Banknote className="w-5 h-5 md:w-6 md:h-6 text-info mr-2" />
        <h3 className="text-body-md md:text-body-lg font-bold text-text-primary">Bank Transfer Details</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="space-y-3 md:space-y-4">
          <div className="bg-surface p-3 md:p-4 rounded-control border border-border">
            <p className="text-caption-md md:text-body-sm text-text-secondary mb-1">Bank Name</p>
            <p className="font-bold text-body-md md:text-body-lg text-text-primary">{bankDetails.bankName}</p>
          </div>
          <div className="bg-surface p-3 md:p-4 rounded-control border border-border">
            <p className="text-caption-md md:text-body-sm text-text-secondary mb-1">Account Name</p>
            <p className="font-bold text-body-md md:text-body-lg text-text-primary">{bankDetails.accountName}</p>
          </div>
        </div>
        <div className="space-y-3 md:space-y-4">
          <div className="bg-surface p-3 md:p-4 rounded-control border border-border">
            <p className="text-caption-md md:text-body-sm text-text-secondary mb-1">Account Number</p>
            <div className="flex items-center">
              <p className="font-bold text-body-md md:text-body-lg font-mono text-text-primary">{bankDetails.accountNumber}</p>
              <button
                onClick={() => copyToClipboard(bankDetails.accountNumber)}
                className="ml-3 md:ml-4 bg-primary/10 text-primary px-2 py-1 md:px-3 md:py-1 rounded-control text-caption-md md:text-body-sm hover:bg-primary/20"
              >
                Copy
              </button>
            </div>
          </div>
          <div className="bg-surface p-3 md:p-4 rounded-control border border-border">
            <p className="text-caption-md md:text-body-sm text-text-secondary mb-1">Amount to Pay</p>
            <p className="font-bold text-h5 md:text-h4 text-primary">{formatCurrency(total)}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 md:mt-6 p-3 md:p-4 bg-warning-background border border-warning-border rounded-surface">
        <h4 className="font-bold text-warning mb-2 text-body-sm md:text-body-md">IMPORTANT INSTRUCTIONS:</h4>
        <ul className="text-caption-md md:text-body-sm text-warning space-y-1">
          <li>• Use <strong>Order #{orderNumber}</strong> as payment description/remark</li>
          <li>• Transfer <strong>exactly {formatCurrency(total)}</strong></li>
          <li>• Upload the receipt below after payment and click on send receipt to seller</li>
          <li>• Receipt will be sent to store owner immediately</li>
        </ul>
      </div>
    </div>
  );
}

function ReceiptUpload({ uploadedReceipt, setUploadedReceipt, handleReceiptUpload }: any) {
  return (
    <div className="border-2 border-dashed border-border-strong rounded-surface p-4 md:p-8 text-center mb-6 md:mb-8">
      {!uploadedReceipt ? (
        <>
          <Upload className="w-10 h-10 md:w-12 md:h-12 text-text-muted mx-auto mb-3 md:mb-4" />
          <h3 className="text-body-md md:text-body-lg font-medium text-text-primary mb-2">Upload Payment Receipt</h3>
          <p className="text-text-secondary text-body-sm md:text-body-md mb-4 md:mb-6">
            Upload a screenshot of your bank transfer confirmation
          </p>
          <input
            type="file"
            id="receipt-upload"
            accept="image/*"
            onChange={handleReceiptUpload}
            className="hidden"
          />
          <label
            htmlFor="receipt-upload"
            className="inline-block bg-primary text-primary-foreground px-4 py-2 md:px-6 md:py-3 rounded-control font-medium hover:bg-primary-hover cursor-pointer text-body-sm md:text-body-md"
          >
            Choose File
          </label>
          <p className="text-caption-md md:text-body-sm text-text-muted mt-3 md:mt-4">
            Accepted: JPG, PNG, PDF (max 5MB)
          </p>
        </>
      ) : (
        <>
          <div className="w-24 h-24 md:w-32 md:h-32 mx-auto mb-3 md:mb-4 border border-border rounded-control overflow-hidden">
            <img
              src={uploadedReceipt}
              alt="Payment receipt"
              className="w-full h-full object-cover"
            />
          </div>
          <h3 className="text-body-md md:text-body-lg font-medium text-text-primary mb-2">Receipt Uploaded!</h3>
          <p className="text-text-secondary text-body-sm md:text-body-md mb-4 md:mb-6">
            Your payment receipt is ready to be sent
          </p>
          <Button variant="link" onClick={() => setUploadedReceipt(null)} className="text-body-sm md:text-body-md">
            Upload different file
          </Button>
        </>
      )}
    </div>
  );
}
