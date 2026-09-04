/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// "You do not need the order number."
//
// Shown above the tracking form, not instead of it. Every confirmation email
// ever sent links to this page, and the reschedule and cancel flows live here,
// so the order-number route has to keep working — a customer holding a number
// from last year should not hit a wall.
//
// What it does is make the better path visible: signing in lists every order
// on the account, with no number to find.
import Link from 'next/link';
import { LogIn } from 'lucide-react';

export default function SignInPrompt() {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-surface border border-border bg-surface p-4 sm:mb-6">
      <div>
        <p className="text-body-sm font-semibold text-text-primary sm:text-body-md">
          Ordered with us before?
        </p>
        <p className="mt-0.5 text-caption-md text-text-secondary sm:text-body-sm">
          Sign in to see every order on your account — no order number needed.
        </p>
      </div>

      <Link
        href="/account/login"
        className="inline-flex items-center gap-1.5 rounded-control border border-primary px-3 py-2 text-body-sm font-medium text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
      >
        <LogIn className="h-4 w-4" aria-hidden="true" />
        Sign in
      </Link>
    </div>
  );
}
