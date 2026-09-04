/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import CheckoutSteps from './CheckoutSteps';

export type CheckoutStep = 'form' | 'payment' | 'confirmation';

const TITLES: Partial<Record<CheckoutStep, { heading: string; subheading: string }>> = {
  form: { heading: 'Checkout', subheading: 'Complete your purchase' },
  payment: { heading: 'Make Payment', subheading: 'Choose how you would like to pay' },
};

/**
 * The return link, step indicator and page title above every checkout step.
 *
 * Extracted from the page so the step-specific markup there stays readable.
 * The title is omitted on the confirmation step because ConfirmationStep has
 * its own heading — showing both reads as two different "your order was
 * submitted" messages.
 */
export default function CheckoutHeader({ step }: { step: CheckoutStep }) {
  const title = TITLES[step];

  return (
    <>
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

      <div className="mb-4 sm:mb-6 md:mb-8">
        <CheckoutSteps step={step} />
      </div>

      {title && (
        <div className="mb-3 sm:mb-4 md:mb-6">
          <h1 className="text-body-lg sm:text-h5 md:text-h4 lg:text-h3 font-bold mb-1 text-text-primary">
            {title.heading}
          </h1>
          <p className="text-caption-md sm:text-body-sm text-text-secondary">{title.subheading}</p>
        </div>
      )}
    </>
  );
}
