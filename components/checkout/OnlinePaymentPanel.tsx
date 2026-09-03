/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// The "pay now" half of the payment step.
//
// One button and an honest description of what it does. The amount shown is
// the same figure the server priced and the same one the provider will be
// opened for — the browser never gets to choose it.
'use client';

import { Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';

interface OnlinePaymentPanelProps {
  total: number;
  isRedirecting: boolean;
  onPay: () => void;
}

export default function OnlinePaymentPanel({ total, isRedirecting, onPay }: OnlinePaymentPanelProps) {
  return (
    <div className="mb-6 rounded-surface border border-border bg-surface p-4 md:p-6">
      <p className="text-body-md text-text-secondary">
        You will finish on our payment provider&apos;s secure page — card, bank, USSD or
        transfer — and come straight back. No receipt to upload, and your order is
        confirmed the moment the payment goes through.
      </p>

      <Button size="lg" className="mt-4 w-full" loading={isRedirecting} onClick={onPay}>
        <Lock className="h-4 w-4" aria-hidden="true" />
        Pay {formatCurrency(total)} now
      </Button>

      <p className="mt-3 flex items-start gap-2 text-caption-md text-text-secondary">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
        <span>
          We never see or store your card details. Your order and the stock for it are
          held while you pay.
        </span>
      </p>
    </div>
  );
}
