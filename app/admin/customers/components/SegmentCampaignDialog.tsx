/** ADMIN layer — one message to one segment.
 *
 * TWO STEPS, ON PURPOSE
 *
 * The first press asks the server who would receive this and shows the number.
 * Only the second sends. An email to a segment cannot be recalled, and the
 * mistake this guards against is not a typo in the message — it is a tag that
 * matches four hundred people when the sender was picturing twelve. That is
 * invisible until it has already happened, so the count is put in front of
 * them before the irreversible press.
 */
'use client';

import { useState } from 'react';
import { Send, Users } from 'lucide-react';
import { Button, Input, Modal, Textarea } from '@/components/ui';

interface SegmentCampaignDialogProps {
  tag: string;
  showToast: (message: string, type?: 'success' | 'error') => void;
  onClose: () => void;
}

export default function SegmentCampaignDialog({ tag, showToast, onClose }: SegmentCampaignDialogProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [recipients, setRecipients] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = subject.trim().length > 0 && message.trim().length > 0;

  const post = async (confirm: boolean) => {
    setBusy(true);
    try {
      const response = await fetch('/api/admin/customers/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag, subject: subject.trim(), message: message.trim(), confirm }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        showToast(result?.error || 'Could not send that message.', 'error');
        // A refused dry run means the count on screen is no longer true.
        setRecipients(null);
        return;
      }

      if (confirm) {
        showToast(result.message, 'success');
        onClose();
        return;
      }

      setRecipients(result.recipients ?? 0);
    } catch {
      showToast('Could not reach the server. Nothing was sent.', 'error');
    } finally {
      setBusy(false);
    }
  };

  // Editing after a count invalidates it — the message changed, and the count
  // belongs to the message the sender is about to approve.
  const edit = <T,>(setter: (value: T) => void) => (value: T) => {
    setRecipients(null);
    setter(value);
  };

  return (
    <Modal open onClose={onClose} title={`Message everyone tagged “${tag}”`} size="lg" scrollable>
      <div className="space-y-4">
        <div>
          <label htmlFor="campaign-subject" className="mb-1.5 block text-body-sm font-medium text-text-primary">
            Subject
          </label>
          <Input
            id="campaign-subject"
            value={subject}
            onChange={(event) => edit(setSubject)(event.target.value)}
            placeholder="What this email is about"
            maxLength={200}
          />
        </div>

        <div>
          <label htmlFor="campaign-message" className="mb-1.5 block text-body-sm font-medium text-text-primary">
            Message
          </label>
          <Textarea
            id="campaign-message"
            rows={8}
            value={message}
            onChange={(event) => edit(setMessage)(event.target.value)}
            placeholder="Written in your own words. It goes out in the shop's usual email frame, with nothing added."
          />
          <p className="mt-1 text-caption-md text-text-secondary">
            Blocked customers are never included.
          </p>
        </div>

        {recipients !== null && (
          <div className="flex items-start gap-3 rounded-surface border border-info-border bg-info-background p-3">
            <Users className="mt-0.5 size-5 shrink-0 text-info" aria-hidden="true" />
            <p className="text-body-sm text-text-primary">
              <strong>
                {recipients} customer{recipients === 1 ? '' : 's'}
              </strong>{' '}
              will receive this. Sending cannot be undone.
            </p>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>

          {recipients === null ? (
            <Button onClick={() => post(false)} disabled={!ready} loading={busy}>
              <Users className="size-4" aria-hidden="true" />
              Check who gets this
            </Button>
          ) : (
            <Button onClick={() => post(true)} disabled={recipients === 0} loading={busy}>
              <Send className="size-4" aria-hidden="true" />
              Send to {recipients}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
