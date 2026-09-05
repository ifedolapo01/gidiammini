/** ADMIN layer — the invitation landing page.
 *
 * A shell around the form so the client component that reads the invitation
 * token out of the query string sits behind a Suspense boundary, which is what
 * useSearchParams requires.
 */
import { Suspense } from 'react';
import { Spinner } from '@/components/ui';
import AcceptInviteForm, {
  AcceptInviteFooter,
  AcceptInviteHeader,
} from './components/AcceptInviteForm';

export const metadata = {
  title: 'Accept your invitation',
  // Never a search result: the URL carries a single-use credential.
  robots: { index: false, follow: false },
};

export default function AcceptInvitePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background-tertiary px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-surface border border-border bg-surface p-8 shadow-elevation-3">
          <AcceptInviteHeader />
          <Suspense fallback={<div className="grid place-items-center py-8"><Spinner /></div>}>
            <AcceptInviteForm />
          </Suspense>
        </div>
        <AcceptInviteFooter />
      </div>
    </div>
  );
}
