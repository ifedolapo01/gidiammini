/** ADMIN layer — the running conversation on one order. Where the change-
 * request pattern generalises to: a support conversation that lives with the
 * order instead of in a chat app. */
'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button, Spinner, Textarea } from '@/components/ui';
import { formatDate } from '@/lib/commerce/format-date';
import { useOrderMessages } from '../hooks/useOrderMessages';

interface OrderMessageThreadProps {
  orderId: string;
}

export default function OrderMessageThread({ orderId }: OrderMessageThreadProps) {
  const { messages, loading, sending, send } = useOrderMessages(orderId);
  const [draft, setDraft] = useState('');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const ok = await send(draft.trim());
    if (ok) setDraft('');
  };

  return (
    <section className="rounded-surface border border-border bg-surface p-4">
      <h3 className="text-body-sm font-semibold text-text-primary">Conversation</h3>

      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner size="sm" className="text-primary" />
        </div>
      ) : messages.length === 0 ? (
        <p className="mt-2 text-body-sm text-text-secondary">
          Nothing yet. A message here reaches the customer by email.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {messages.map((message) => (
            <li
              key={message.id}
              className={message.sender === 'admin' ? 'text-right' : 'text-left'}
            >
              <div
                className={`inline-block max-w-[85%] rounded-control px-3 py-2 text-body-sm ${
                  message.sender === 'admin'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background-secondary text-text-primary'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.body}</p>
              </div>
              <p className="mt-0.5 text-caption-md text-text-secondary">
                {message.sender === 'admin' ? 'You' : 'Customer'} · {formatDate(message.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSend} className="mt-4 flex items-start gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="Reply to the customer (sent by email)"
          className="flex-1"
        />
        <Button type="submit" loading={sending} disabled={!draft.trim()}>
          <Send className="size-4" aria-hidden="true" />
          Send
        </Button>
      </form>
    </section>
  );
}
