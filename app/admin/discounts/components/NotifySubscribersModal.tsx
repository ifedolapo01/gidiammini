/** ADMIN layer — modal for emailing subscribers about an active discount. */
'use client';

import { Send } from 'lucide-react';
import { Button, Input, Textarea, Modal } from '@/components/ui';
import type { Discount } from '@/lib/commerce/discounts';

interface NotifySubscribersModalProps {
  discount: Discount | null;
  subject: string;
  message: string;
  isSending: boolean;
  onSubjectChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function NotifySubscribersModal({
  discount, subject, message, isSending,
  onSubjectChange, onMessageChange, onClose, onSubmit,
}: NotifySubscribersModalProps) {
  if (!discount) return null;

  return (
    <Modal open onClose={onClose} title="Notify Subscribers" size="md">
      <p className="text-text-secondary mb-6">
        Send an immediate email to all your active subscribers about <strong>{discount.name}</strong>.
      </p>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-body-sm font-semibold text-text-primary mb-1.5">Email Subject</label>
          <Input
            type="text"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-body-sm font-semibold text-text-primary mb-1.5">Email Message</label>
          <Textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            className="h-32"
            required
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={isSending}
        >
          Cancel
        </Button>
        <Button
          variant="success"
          onClick={onSubmit}
          disabled={isSending || !subject || !message}
          loading={isSending}
        >
          {!isSending && <Send size={16} />}
          {isSending ? 'Sending...' : 'Send Now'}
        </Button>
      </div>
    </Modal>
  );
}
