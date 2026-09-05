/** ADMIN layer — whether this page is being pushed updates or checking for
 * them.
 *
 * Worth showing rather than hiding. Realtime can be unavailable for reasons
 * nobody on the page can see — a dropped socket, a connection limit, a
 * migration not yet applied — and the difference between "this list updates
 * itself" and "this list is a couple of minutes behind" changes how much an
 * operator should trust what is in front of them before ringing a customer.
 *
 * The fallback state is deliberately not an error. Polling is a supported way
 * to run; it is just slower.
 */
'use client';

import { Radio, RefreshCw } from 'lucide-react';

interface LiveIndicatorProps {
  live: boolean;
  /** What is being watched, for the tooltip: "orders", "stock". */
  subject: string;
}

export default function LiveIndicator({ live, subject }: LiveIndicatorProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-caption-md ${
        live ? 'text-success' : 'text-text-secondary'
      }`}
      title={
        live
          ? `Connected — ${subject} update as they change.`
          : `Not connected — ${subject} are refreshed on a timer instead.`
      }
    >
      {live ? (
        <Radio className="w-3.5 h-3.5" aria-hidden="true" />
      ) : (
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
      )}
      <span className="sr-only">Update mode: </span>
      {live ? 'Live' : 'Periodic'}
    </span>
  );
}
