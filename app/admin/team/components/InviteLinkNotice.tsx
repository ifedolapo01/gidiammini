/** ADMIN layer — the fallback when an invitation email could not be sent.
 *
 * An account created but unreachable is worse than no account: the owner
 * believes somebody was invited and nobody was. So the link is shown here to
 * be passed on by hand. It is a credential, which is why it says so and why it
 * has to be dismissed deliberately rather than fading away.
 */
'use client';

import { useState } from 'react';
import { Copy, Check, X } from 'lucide-react';
import { Button } from '@/components/ui';

interface InviteLinkNoticeProps {
  url: string;
  onDismiss: () => void;
}

export default function InviteLinkNotice({ url, onDismiss }: InviteLinkNoticeProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the link is on screen to select.
      setCopied(false);
    }
  }

  return (
    <div
      role="alert"
      className="rounded-surface border border-warning-border bg-warning-background p-3 sm:p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body-sm font-medium text-warning">
            The invitation email could not be sent.
          </p>
          <p className="mt-1 text-caption-md text-text-secondary">
            Send them this link yourself. It lets whoever opens it set the password on
            that account, so treat it like one.
          </p>
          <code className="mt-2 block break-all rounded-control bg-surface p-2 text-caption-md text-text-primary">
            {url}
          </code>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss the invitation link"
          className="grid size-8 shrink-0 place-items-center rounded-control text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <Button variant="outline" size="sm" className="mt-3" onClick={copy}>
        {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        {copied ? 'Copied' : 'Copy link'}
      </Button>
    </div>
  );
}
