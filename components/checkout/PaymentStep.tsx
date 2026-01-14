'use client';

import { Banknote, ArrowLeft, Upload, MessageCircle } from 'lucide-react';

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
    bankName: 'OPAY',
    accountName: 'Ifedolapo Ajayi',
    accountNumber: '8096539067',
    sortCode: '011'
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 md:p-8 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 md:mb-8">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">Make Payment</h2>
            <p className="text-gray-600 text-sm md:text-base">Order #{orderNumber}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`px-3 py-1 rounded-full text-xs md:text-sm font-medium ${
                deliveryOption === 'pickup' ? 'bg-blue-100 text-blue-700' : 'bg-gray-900 text-white'
              }`}>
                {deliveryOption === 'pickup' 
                  ? 'Pickup (Abuja Only)' 
                  : selectedState === 'Abuja' 
                  ? 'Delivery (Abuja)' 
                  : 'Park Drop-off'
                } • {selectedState}
              </span>
              <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs md:text-sm font-medium">
                Awaiting Payment
              </span>
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
          <button
            onClick={() => setStep('form')}
            className="flex-1 border border-gray-300 text-gray-700 py-3 md:py-4 rounded-lg md:rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center text-sm md:text-base"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 mr-2" />
            Edit Order Details
          </button>
          
          <button
            onClick={handleSendReceipt}
            disabled={!uploadedReceipt || isProcessing}
            className="flex-1 bg-green-600 text-white py-3 md:py-4 rounded-lg md:rounded-xl font-semibold md:font-bold text-base md:text-lg hover:bg-green-700 disabled:bg-gray-400 transition-all flex items-center justify-center"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 md:w-5 md:h-5 border-t-2 border-white rounded-full animate-spin mr-2"></div>
                <span className="text-sm md:text-base">Sending to Store Owner...</span>
              </>
            ) : (
              <>
                <MessageCircle className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                <span className="text-sm md:text-base">Send Receipt to Seller</span>
              </>
            )}
          </button>
        </div>

        {/* WhatsApp Note */}
        <div className="mt-6 md:mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <MessageCircle className="w-4 h-4 md:w-5 h-5 text-green-600 mr-2" />
            <h4 className="font-bold text-green-800 text-sm md:text-base">Automatic Email Notification:</h4>
          </div>
          <p className="text-xs md:text-sm text-green-700 mt-2">
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
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 md:p-6 mb-6 md:mb-8">
      <div className="flex items-center mb-4">
        <Banknote className="w-5 h-5 md:w-6 md:h-6 text-blue-600 mr-2" />
        <h3 className="text-base md:text-lg font-bold text-gray-800">Bank Transfer Details</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="space-y-3 md:space-y-4">
          <div className="bg-white p-3 md:p-4 rounded-lg border">
            <p className="text-xs md:text-sm text-gray-600 mb-1">Bank Name</p>
            <p className="font-bold text-base md:text-lg text-gray-900">{bankDetails.bankName}</p>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-lg border">
            <p className="text-xs md:text-sm text-gray-600 mb-1">Account Name</p>
            <p className="font-bold text-base md:text-lg text-gray-900">{bankDetails.accountName}</p>
          </div>
        </div>
        <div className="space-y-3 md:space-y-4">
          <div className="bg-white p-3 md:p-4 rounded-lg border">
            <p className="text-xs md:text-sm text-gray-600 mb-1">Account Number</p>
            <div className="flex items-center">
              <p className="font-bold text-base md:text-lg font-mono text-gray-900">{bankDetails.accountNumber}</p>
              <button
                onClick={() => copyToClipboard(bankDetails.accountNumber)}
                className="ml-3 md:ml-4 bg-blue-100 text-blue-600 px-2 py-1 md:px-3 md:py-1 rounded text-xs md:text-sm hover:bg-blue-200"
              >
                Copy
              </button>
            </div>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-lg border">
            <p className="text-xs md:text-sm text-gray-600 mb-1">Amount to Pay</p>
            <p className="font-bold text-xl md:text-2xl text-blue-600">₦{total.toLocaleString()}</p>
          </div>
        </div>
      </div>
      
      <div className="mt-4 md:mt-6 p-3 md:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h4 className="font-bold text-yellow-800 mb-2 text-sm md:text-base">IMPORTANT INSTRUCTIONS:</h4>
        <ul className="text-xs md:text-sm text-yellow-700 space-y-1">
          <li>• Use <strong>Order #{orderNumber}</strong> as payment description/remark</li>
          <li>• Transfer <strong>exactly ₦{total.toLocaleString()}</strong></li>
          <li>• Upload the receipt below after payment and click on send receipt to seller</li>
          <li>• Receipt will be sent to store owner immediately</li>
        </ul>
      </div>
    </div>
  );
}

function ReceiptUpload({ uploadedReceipt, setUploadedReceipt, handleReceiptUpload }: any) {
  return (
    <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 md:p-8 text-center mb-6 md:mb-8">
      {!uploadedReceipt ? (
        <>
          <Upload className="w-10 h-10 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 md:mb-4" />
          <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">Upload Payment Receipt</h3>
          <p className="text-gray-600 text-sm md:text-base mb-4 md:mb-6">
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
            className="inline-block bg-blue-600 text-white px-4 py-2 md:px-6 md:py-3 rounded-lg font-medium hover:bg-blue-700 cursor-pointer text-sm md:text-base"
          >
            Choose File
          </label>
          <p className="text-xs md:text-sm text-gray-500 mt-3 md:mt-4">
            Accepted: JPG, PNG, PDF (max 5MB)
          </p>
        </>
      ) : (
        <>
          <div className="w-24 h-24 md:w-32 md:h-32 mx-auto mb-3 md:mb-4 border rounded-lg overflow-hidden">
            <img 
              src={uploadedReceipt} 
              alt="Payment receipt" 
              className="w-full h-full object-cover"
            />
          </div>
          <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">Receipt Uploaded!</h3>
          <p className="text-gray-600 text-sm md:text-base mb-4 md:mb-6">
            Your payment receipt is ready to be sent
          </p>
          <button
            onClick={() => setUploadedReceipt(null)}
            className="text-blue-600 hover:text-blue-800 font-medium text-sm md:text-base"
          >
            Upload different file
          </button>
        </>
      )}
    </div>
  );
}