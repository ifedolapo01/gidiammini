/** STOREFRONT layer — the customer's side of the running conversation on
 * their order. No live polling here on purpose: the order lookup this reuses
 * to refresh (onOrderUpdate) is rate-limited against abuse of the order-number
 * + contact lookup itself, so an interval poll would eventually rate-limit a
 * customer for having the page open. Each side is emailed when the other
 * posts instead — see app/api/orders/messages and app/api/orders/[id]/messages. */
'use client';

import { useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';
import { Button, Textarea } from '@/components/ui';
import { formatDate } from '@/lib/commerce/format-date';
import type { OrderMessage } from '@/types/orderMessage';

interface CustomerMessageThreadProps {
  orderNumber: string;
  contact: string;
  messages: OrderMessage[];
  onOrderUpdate: () => void;
}

export default function CustomerMessageThread({ orderNumber, contact, messages, onOrderUpdate }: CustomerMessageThreadProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/orders/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, contact, body: draft.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setDraft('');
        onOrderUpdate();
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    onOrderUpdate();
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <div className="bg-surface p-4 md:p-6 rounded-surface shadow-elevation-1 border border-border">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold text-body-md md:text-body-lg text-text-primary">Messages</h3>
        <button
          type="button"
          onClick={handleRefresh}
          className="flex items-center gap-1 text-caption-md font-medium text-primary hover:text-primary-hover"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Check for replies
        </button>
      </div>

      {messages.length === 0 ? (
        <p className="text-body-sm text-text-secondary">
          Have a question about this order? Send us a message — we&rsquo;ll reply by email.
        </p>
      ) : (
        <ul className="space-y-3">
          {messages
            .slice()
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .map((message) => (
              <li key={message.id} className={message.sender === 'customer' ? 'text-right' : 'text-left'}>
                <div
                  className={`inline-block max-w-[85%] rounded-control px-3 py-2 text-body-sm ${
                    message.sender === 'customer'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background-secondary text-text-primary'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.body}</p>
                </div>
                <p className="mt-0.5 text-caption-md text-text-secondary">
                  {message.sender === 'customer' ? 'You' : 'Us'} · {formatDate(message.created_at)}
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
          placeholder="Type a message…"
          className="flex-1"
        />
        <Button type="submit" loading={sending} disabled={!draft.trim()}>
          <Send className="size-4" aria-hidden="true" />
          Send
        </Button>
      </form>
      {error && <p className="mt-2 text-body-sm text-destructive">{error}</p>}
    </div>
  );
}
