/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// "We filled this in from your last order."
//
// Worth saying out loud. A form that is mysteriously already populated makes a
// careful person check every field; naming where it came from, and whose
// account it is, turns that into a glance. It also gives somebody using a
// shared phone the one thing they need — a way to notice it is not them.
import Link from 'next/link';
import { UserCheck } from 'lucide-react';

interface PrefilledNoticeProps {
  email: string | null;
}

export function PrefilledNotice({ email }: PrefilledNoticeProps) {
  if (!email) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-control border border-success-border bg-success-background p-3">
      <p className="flex items-center gap-2 text-body-sm text-success">
        <UserCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Filled in from your last order — signed in as{' '}
          <strong className="font-semibold">{email}</strong>
        </span>
      </p>
      <Link
        href="/account"
        className="text-caption-md font-medium text-success underline-offset-4 hover:underline"
      >
        Your orders
      </Link>
    </div>
  );
}
