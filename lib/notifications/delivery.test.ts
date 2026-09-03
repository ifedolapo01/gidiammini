/**
 * The wording an admin sees after a notification.
 *
 * The point of these tests is the negative case: the message must never imply
 * the customer was reached when they weren't. That was the original bug — a
 * stubbed SMS layer reported success and the UI said "Customer has been
 * notified" regardless.
 */
import { describe, it, expect } from 'vitest';
import { describeDelivery, anyDelivered, withDeliveryNote, type DeliveryOutcome } from './delivery';

const outcome = (over: Partial<DeliveryOutcome> = {}): DeliveryOutcome => ({
  delivered: [], failed: [], ...over,
});

describe('describeDelivery', () => {
  it('names both channels when both went out', () => {
    expect(describeDelivery(outcome({ delivered: ['email', 'sms'] }))).toBe('Email sent · SMS sent');
  });

  it('reports the unconfigured channel alongside the one that worked', () => {
    // The headline case: this is what should appear until Termii is set up.
    expect(describeDelivery(outcome({
      delivered: ['email'],
      failed: [{ channel: 'sms', reason: 'not_configured' }],
    }))).toBe('Email sent · SMS not configured');
  });

  it('says a number is missing rather than blaming configuration', () => {
    expect(describeDelivery(outcome({
      delivered: ['email'],
      failed: [{ channel: 'sms', reason: 'no_recipient' }],
    }))).toBe('Email sent · SMS no number on file');
  });

  it('distinguishes an unusable number from a missing one', () => {
    expect(describeDelivery(outcome({
      delivered: ['email'],
      failed: [{ channel: 'sms', reason: 'invalid_recipient' }],
    }))).toBe('Email sent · SMS invalid number');
  });

  it('reports a provider failure', () => {
    expect(describeDelivery(outcome({
      delivered: ['email'],
      failed: [{ channel: 'sms', reason: 'provider_error', detail: 'timeout' }],
    }))).toBe('Email sent · SMS failed to send');
  });

  it('never claims delivery when nothing went out', () => {
    const text = describeDelivery(outcome({
      failed: [
        { channel: 'email', reason: 'provider_error' },
        { channel: 'sms', reason: 'not_configured' },
      ],
    }));
    expect(text).toBe('Nothing sent — Email failed to send, SMS not configured');
    expect(text).not.toMatch(/sent ·/);
  });

  it('handles the empty outcome without inventing a claim', () => {
    expect(describeDelivery(outcome())).toBe('Nothing sent');
  });

  it('stays quiet about a channel the caller deliberately skipped', () => {
    // "SMS skipped" is noise when the admin unticked SMS themselves.
    expect(describeDelivery(outcome({
      delivered: ['email'],
      failed: [{ channel: 'sms', reason: 'not_requested' }],
    }))).toBe('Email sent');
  });

  it('does not report "Nothing sent — SMS skipped" when only email was asked for', () => {
    expect(describeDelivery(outcome({
      failed: [{ channel: 'sms', reason: 'not_requested' }],
    }))).toBe('Nothing sent');
  });
});

describe('describeDelivery — email says "address", not "number"', () => {
  it('reports a missing email address in email words', () => {
    // Reusing the SMS wording here produced "Email no number on file".
    expect(describeDelivery(outcome({
      delivered: ['sms'],
      failed: [{ channel: 'email', reason: 'no_recipient' }],
    }))).toBe('SMS sent · Email no address on file');
  });

  it('reports an unusable email address in email words', () => {
    expect(describeDelivery(outcome({
      failed: [{ channel: 'email', reason: 'invalid_recipient' }],
    }))).toBe('Nothing sent — Email invalid address');
  });

  it('keeps the shared wording for reasons that read the same either way', () => {
    expect(describeDelivery(outcome({
      failed: [
        { channel: 'email', reason: 'not_configured' },
        { channel: 'sms', reason: 'not_configured' },
      ],
    }))).toBe('Nothing sent — Email not configured, SMS not configured');
  });

  it('describes each channel in its own terms in one line', () => {
    expect(describeDelivery(outcome({
      failed: [
        { channel: 'email', reason: 'no_recipient' },
        { channel: 'sms', reason: 'no_recipient' },
      ],
    }))).toBe('Nothing sent — Email no address on file, SMS no number on file');
  });
});

describe('anyDelivered', () => {
  it('is true only when a channel actually delivered', () => {
    expect(anyDelivered(outcome({ delivered: ['sms'] }))).toBe(true);
    expect(anyDelivered(outcome({ failed: [{ channel: 'sms', reason: 'not_configured' }] }))).toBe(false);
    expect(anyDelivered(outcome())).toBe(false);
  });
});

describe('withDeliveryNote', () => {
  it('appends the real outcome to an action message', () => {
    expect(withDeliveryNote('Order confirmed.', outcome({
      delivered: ['email'],
      failed: [{ channel: 'sms', reason: 'not_configured' }],
    }))).toBe('Order confirmed. Email sent · SMS not configured.');
  });

  it('is honest even when the action succeeded and the notification did not', () => {
    expect(withDeliveryNote('Order cancelled.', outcome({
      failed: [{ channel: 'email', reason: 'provider_error' }],
    }))).toBe('Order cancelled. Nothing sent — Email failed to send.');
  });
});
