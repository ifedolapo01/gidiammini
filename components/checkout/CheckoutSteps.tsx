/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// Where you are in checkout.
//
// It used to draw all three steps at once — Your Details, Make Payment,
// Confirmation — which stopped being true when online payment arrived. Paying
// at the provider leaves the site and comes back to its own page, so "three
// steps" is now only the transfer route, and which route it is gets chosen on
// step two. A tracker promising a shape the flow may not take is worse than no
// tracker.
//
// So it names the step you are on and nothing else. Still oriented, no longer
// making a promise it cannot keep.
import { CheckCircle } from 'lucide-react';

interface CheckoutStepsProps {
  step: 'form' | 'payment' | 'confirmation';
}

const LABELS: Record<CheckoutStepsProps['step'], string> = {
  form: 'Your Details',
  payment: 'Payment',
  confirmation: 'Confirmed',
};

export default function CheckoutSteps({ step }: CheckoutStepsProps) {
  const done = step === 'confirmation';

  return (
    <div className="mb-6 flex justify-center md:mb-8">
      <span
        // aria-current so a screen reader hears this as the current step of a
        // process, not as a stray heading.
        aria-current="step"
        className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5"
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-caption-md font-semibold ${
            done ? 'bg-success-background text-success' : 'bg-primary/10 text-primary'
          }`}
        >
          {done ? <CheckCircle className="h-4 w-4" aria-hidden="true" /> : step === 'form' ? '1' : '2'}
        </span>
        <span className="text-body-sm font-medium text-text-primary md:text-body-md">
          {LABELS[step]}
        </span>
      </span>
    </div>
  );
}
