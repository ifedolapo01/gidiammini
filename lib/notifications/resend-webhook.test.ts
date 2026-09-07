/**
 * notificationUpdateFor and bouncedRecipients are the only place that decides
 * what a Resend event means, so a mistake here is a mistake in every
 * production email's status forever. The one worth pinning hardest is that a
 * complaint never suppresses a subscriber — the schema has no vocabulary for
 * "unwanted but live", and mislabelling it as a bounce would put a false entry
 * in an audit trail (see the header of subscriber-suppress.ts).
 */
import { describe, it, expect } from 'vitest';
import type { WebhookEventPayload } from 'resend';
import { notificationUpdateFor, bouncedRecipients } from './resend-webhook';

const BASE = {
  created_at: '2026-09-07T00:00:00.000Z',
  email_id: 'a1b2c3d4-0000-4000-8000-000000000000',
  from: 'orders@shop.com',
  to: ['customer@example.com'],
  subject: 'Your order has shipped',
};

function event(type: WebhookEventPayload['type'], data: Record<string, unknown> = {}): WebhookEventPayload {
  return { type, created_at: BASE.created_at, data: { ...BASE, ...data } } as WebhookEventPayload;
}

describe('notificationUpdateFor', () => {
  it('marks a delivered event with no detail', () => {
    expect(notificationUpdateFor(event('email.delivered'))).toEqual({
      providerMessageId: BASE.email_id,
      status: 'delivered',
    });
  });

  it('carries the bounce message through as the detail', () => {
    expect(
      notificationUpdateFor(event('email.bounced', { bounce: { type: 'Permanent', subType: 'General', message: 'mailbox does not exist' } }))
    ).toEqual({
      providerMessageId: BASE.email_id,
      status: 'bounced',
      detail: 'mailbox does not exist',
    });
  });

  it('marks a complaint with no detail', () => {
    expect(notificationUpdateFor(event('email.complained'))).toEqual({
      providerMessageId: BASE.email_id,
      status: 'complained',
    });
  });

  it('carries the failure reason through as the detail', () => {
    expect(notificationUpdateFor(event('email.failed', { failed: { reason: 'domain not verified' } }))).toEqual({
      providerMessageId: BASE.email_id,
      status: 'failed',
      detail: 'domain not verified',
    });
  });

  it('ignores event types this shop does not act on', () => {
    for (const type of ['email.sent', 'email.opened', 'email.clicked', 'email.delivery_delayed'] as const) {
      expect(notificationUpdateFor(event(type))).toBeNull();
    }
  });
});

describe('bouncedRecipients', () => {
  it('returns the recipients of a bounce', () => {
    expect(bouncedRecipients(event('email.bounced', { to: ['dead@example.com'] }))).toEqual([
      'dead@example.com',
    ]);
  });

  it('is empty for a complaint', () => {
    // The address is still live — see notificationUpdateFor's doc comment for
    // why this must never be treated the same as a bounce.
    expect(bouncedRecipients(event('email.complained'))).toEqual([]);
  });

  it('is empty for a delivered event', () => {
    expect(bouncedRecipients(event('email.delivered'))).toEqual([]);
  });
});
