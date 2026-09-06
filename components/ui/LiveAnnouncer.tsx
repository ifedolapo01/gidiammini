/**
 * CORE layer — generic UI primitive. Token-based, no business branding.
 *
 * The live region every `announce()` call ends up in. One per layout, mounted
 * once, near the end of the body.
 *
 * Two regions rather than one, because a region's politeness is fixed at the
 * moment the browser reads it — flipping aria-live on an existing node is not
 * reliably picked up. Each holds only the most recent message for its level.
 *
 * The regions are rendered empty on the server and stay empty until something
 * is announced, so there is nothing here to mismatch during hydration.
 */
'use client';

import { useEffect, useState } from 'react';
import { subscribeToAnnouncements, type Announcement } from '@/lib/announce';

export function LiveAnnouncer() {
  const [polite, setPolite] = useState<Announcement | null>(null);
  const [assertive, setAssertive] = useState<Announcement | null>(null);

  useEffect(
    () =>
      subscribeToAnnouncements((announcement) => {
        if (announcement.politeness === 'assertive') setAssertive(announcement);
        else setPolite(announcement);
      }),
    [],
  );

  return (
    <>
      {/* `key` on the inner node, not the region: replacing the region itself
          would hand the browser a brand-new live element, which is exactly the
          case screen readers are least consistent about announcing. Replacing
          a child *inside* a region that has been present all along is the
          mutation they all handle. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {polite && <span key={polite.token}>{polite.message}</span>}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertive && <span key={assertive.token}>{assertive.message}</span>}
      </div>
    </>
  );
}
