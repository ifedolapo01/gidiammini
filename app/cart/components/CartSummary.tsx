/** STOREFRONT layer — the cart's order summary. Presentation only. */
'use client';

import Link from 'next/link';
import { formatCurrency } from '@/lib/commerce/pricing';
import { calculateTax, TAX_RATE } from '@/lib/commerce/checkout';

interface CartSummaryProps {
  subtotal: number;
  /** Units, not lines — the same number the header badge shows. */
  itemCount: number;
  /** How many lines the live stock check found unbuyable. */
  issueCount: number;
}

export default function CartSummary({ subtotal, itemCount, issueCount }: CartSummaryProps) {
  // calculateTax rather than the rate inline: it rounds to whole Naira, which
  // is what checkout and the order row will charge. Computing it any other way
  // here shows the customer a total the next screen contradicts.
  const tax = calculateTax(subtotal);

  return (
    <div className="bg-surface rounded-surface shadow-elevation-1 border border-border p-4 sm:p-6 sticky top-20 sm:top-24 text-text-primary">
      <h2 className="text-body-lg sm:text-h5 font-bold mb-4 sm:mb-6">Order Summary</h2>

      <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
        <div className="flex justify-between text-body-sm sm:text-body-md">
          <span>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-body-sm sm:text-body-md">
          <span>Shipping</span>
          <span className="text-text-secondary">Calculated at checkout</span>
        </div>
        <div className="flex justify-between text-body-sm sm:text-body-md">
          <span>Tax ({TAX_RATE * 100}%)</span>
          <span>{formatCurrency(tax)}</span>
        </div>
      </div>

      <div className="border-t border-border pt-3 sm:pt-4 mb-4 sm:mb-6">
        <div className="flex justify-between text-body-md sm:text-body-lg font-bold">
          <span>Estimated Total</span>
          <span className="text-primary">{formatCurrency(subtotal + tax)}</span>
        </div>
        <p className="text-caption-md sm:text-body-sm text-text-secondary mt-1 sm:mt-2">
          Shipping fee will be added based on location
        </p>
      </div>

      {/* Repeated next to the button because on a phone the flagged row is
          often scrolled off by the time the shopper reaches it. */}
      {issueCount > 0 && (
        <p
          role="status"
          className="mb-3 sm:mb-4 rounded-control border border-warning-border bg-warning-background p-2 sm:p-3 text-caption-md sm:text-body-sm text-warning"
        >
          {issueCount === 1
            ? 'One item above is no longer available in the quantity you asked for. Please update it before checking out.'
            : `${issueCount} items above are no longer available in the quantities you asked for. Please update them before checking out.`}
        </p>
      )}

      <Link
        href="/checkout"
        className="block w-full bg-primary text-primary-foreground text-center py-2 sm:py-3 rounded-control font-semibold text-body-sm sm:text-body-md hover:bg-primary-hover mb-3 sm:mb-4"
      >
        Proceed to Checkout
      </Link>

      <Link
        href="/products"
        className="block w-full border border-border text-center py-2 sm:py-3 rounded-control font-semibold text-body-sm sm:text-body-md hover:bg-surface-hover"
      >
        Continue Shopping
      </Link>
    </div>
  );
}
