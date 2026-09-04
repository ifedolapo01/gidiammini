/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// The choice a signed-out shopper gets at checkout.
//
// An offer, not a wall. Requiring an account before a first purchase is one of
// the largest causes of abandoned carts anywhere, and it is worse here: a new
// customer has no account to sign into, because an account is created *by*
// ordering. So guest checkout stays, and signing in is presented as what it
// actually is — a shortcut for people who have bought before.
//
// The guest option is a real button of equal weight, not a link hidden under
// the fold. Anything else is a wall wearing a choice's clothes.
'use client';

import Link from 'next/link';
import { LogIn, ShoppingBag, Truck, History, MapPin } from 'lucide-react';
import { Button } from '@/components/ui';

interface CheckoutSignInGateProps {
  /** From useCheckoutIdentity. The gate owns its own waiting state, the way a
   *  rail owns its empty one — the page should not have to know that there is
   *  a moment where the answer has not arrived. */
  identity: {
    status: 'checking' | 'guest' | 'signed-in';
    continueAsGuest: () => void;
  };
}

const PERKS = [
  { Icon: MapPin, text: 'Your name, phone and delivery address filled in for you' },
  { Icon: History, text: 'Every order you have placed, in one list' },
  { Icon: Truck, text: 'Track any of them without hunting for an order number' },
];

export default function CheckoutSignInGate({ identity }: CheckoutSignInGateProps) {
  // Nothing until the answer lands. Flashing "sign in?" at somebody who is
  // already signed in is worse than a blank moment.
  if (identity.status !== 'guest') {
    return <div className="min-h-screen bg-background-secondary" />;
  }

  return (
    <div className="min-h-screen bg-background-secondary py-8 sm:py-12">
      <div className="mx-auto w-full max-w-lg px-4">
      <div className="rounded-surface border border-border bg-surface p-6 md:p-8">
        <h1 className="text-h5 font-bold text-text-primary md:text-h4">Bought from us before?</h1>
        <p className="mt-2 text-body-md text-text-secondary">
          Sign in and we will fill this in for you. No password — we email you a link.
        </p>

        <ul className="mt-4 space-y-2">
          {PERKS.map((perk) => (
            <li key={perk.text} className="flex items-start gap-2 text-body-sm text-text-secondary">
              <perk.Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              {perk.text}
            </li>
          ))}
        </ul>

        {/* next= brings them back here once the link is opened in this browser. */}
        <Link href="/account/login?next=/checkout" className="mt-5 block">
          <Button size="lg" className="w-full">
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Sign in to my orders
          </Button>
        </Link>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-divider" />
          <span className="text-caption-md text-text-muted">or</span>
          <span className="h-px flex-1 bg-divider" />
        </div>

        <Button variant="outline" size="lg" className="w-full" onClick={identity.continueAsGuest}>
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          Continue as guest
        </Button>

        <p className="mt-3 text-caption-md text-text-secondary">
          First time here? Continue as guest — we create your account with the order, so
            next time everything is already saved and you can sign in with this email.
          </p>
        </div>
      </div>
    </div>
  );
}
