/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// Sign in with no password: type the email or phone you checked out with.
//
// noindex. There is nothing here for a crawler, and an indexed sign-in page is
// a page that gets probed.
import type { Metadata } from 'next';
import { SignInForm } from './components/SignInForm';

export const metadata: Metadata = {
  title: 'Sign in to your orders',
  description: 'See your order history and reorder anything you have bought before.',
  robots: { index: false, follow: false },
};

export default function AccountLoginPage() {
  return (
    <div className="min-h-screen bg-background-secondary">
      <div className="container mx-auto max-w-md px-4 py-12 md:py-16">
        <header className="mb-6 text-center">
          <h1 className="text-h4 font-bold text-text-primary md:text-h3">Your orders</h1>
          <p className="mt-2 text-body-md text-text-secondary">
            No password. Tell us the email address or phone number you used at
            checkout and we will email you a link.
          </p>
        </header>

        <SignInForm />

        <p className="mt-6 text-center text-caption-md text-text-secondary">
          Have an order number to hand?{' '}
          <a href="/track-order" className="text-primary underline-offset-4 hover:underline">
            Track a single order instead
          </a>
          .
        </p>
      </div>
    </div>
  );
}
