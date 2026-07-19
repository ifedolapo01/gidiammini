/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { Banknote } from 'lucide-react';
import { formatCurrency } from '@/lib/commerce/pricing';

interface BankDetailsProps {
  bankDetails: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    sortCode: string;
  };
  orderNumber: string;
  total: number;
}

export default function BankDetails({ bankDetails, orderNumber, total }: BankDetailsProps) {
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
