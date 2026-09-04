/**
 * STOREFRONT layer — says when the connection has gone, and what still works.
 *
 * Without it, a dropped connection on a cached page looks like a shop that has
 * silently broken: images resolve, links work, and then one tap does nothing
 * with no explanation. The banner turns that into a state the visitor
 * understands — and says the useful part, which is that the basket is safe.
 *
 * `navigator.onLine` only knows whether the device has *a* network, not
 * whether it reaches us, so it is treated as a hint that something is wrong
 * rather than as proof. It is right about the case that matters here: the
 * signal dropping entirely.
 */
'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  // Starts online whatever the device says. Rendering "you are offline" during
  // hydration on a perfectly good connection — which is what reading
  // navigator.onLine in the initial state would risk — is worse than a moment
  // without the banner.
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);

    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      // Polite, not assertive: it is a change of conditions, not the result of
      // anything the visitor just did.
      role="status"
      className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-warning-background px-4 py-2 text-center text-caption-md text-warning border-b border-warning-border sm:text-body-sm"
    >
      <WifiOff className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>
        <strong className="font-semibold">You are offline.</strong> You can keep browsing pages you
        have already seen — your basket is saved and will be here when the signal returns.
      </span>
    </div>
  );
}
