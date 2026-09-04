/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives). */
// What the service worker shows for a page nobody has visited before, on a
// connection that has gone.
//
// Deliberately static and dependency-free: it is served from the cache when
// there is no network, so anything it needed to fetch would be the one thing
// it cannot have. No header, no footer, no product data — those all reach for
// the network on render.
//
// It is a page rather than a string in sw.js so it is styled by the same
// tokens as the rest of the shop and cannot drift from them.
import Link from 'next/link';
import type { Metadata } from 'next';
import { WifiOff } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="container mx-auto flex min-h-[70vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-full max-w-md">
        <WifiOff className="mx-auto mb-4 h-12 w-12 text-text-muted" aria-hidden="true" />

        <h1 className="mb-3 text-h5 font-bold text-text-primary sm:text-h4">
          You are offline
        </h1>
        <p className="mb-8 text-body-sm text-text-secondary sm:text-body-md">
          This page has not been opened on this device before, so there is no copy
          saved to show you. Anything you have already browsed still works.
        </p>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/products"
            className="inline-flex h-11 w-full items-center justify-center rounded-control bg-primary px-6 text-body-md font-semibold text-primary-foreground hover:bg-primary-hover sm:w-auto"
          >
            Products you have seen
          </Link>
          <Link
            href="/cart"
            className="inline-flex h-11 w-full items-center justify-center rounded-control border border-border-strong px-6 text-body-md font-semibold text-text-primary hover:bg-surface-hover sm:w-auto"
          >
            Your basket
          </Link>
        </div>

        {/* The reassurance that matters. The cart is in localStorage and does
            not need a network to survive — see CartProvider. */}
        <p className="mt-8 text-caption-md text-text-secondary">
          Your basket is saved on this device. Nothing in it is lost while you are
          offline, and you can check out as soon as the signal returns.
        </p>
      </div>
    </div>
  );
}
