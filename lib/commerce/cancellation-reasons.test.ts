import { describe, expect, it } from 'vitest';
import {
  CANCELLATION_CODES,
  CANCELLATION_REASONS,
  cancellationLabel,
  cancellationMessage,
  findCancellationReason,
  isCancellationCode,
} from './cancellation-reasons';

describe('the cancellation vocabulary', () => {
  it('has one entry per code, and no entry without a code', () => {
    expect(CANCELLATION_REASONS.map((reason) => reason.code)).toEqual([...CANCELLATION_CODES]);
  });

  it('gives every ground the four things a consumer needs', () => {
    // The picker needs a label and a hint, the email needs a sentence, and the
    // report needs an origin. A ground missing any of them breaks one of them
    // silently.
    for (const reason of CANCELLATION_REASONS) {
      expect(reason.label, reason.code).toBeTruthy();
      expect(reason.hint, reason.code).toBeTruthy();
      expect(reason.customerMessage, reason.code).toBeTruthy();
      expect(['shop', 'customer', 'neither'], reason.code).toContain(reason.origin);
    }
  });

  it('keeps a fallback ground, so the picker is never a dead end', () => {
    expect(findCancellationReason('other')).toBeDefined();
  });

  it('never tells a customer they are suspected of fraud', () => {
    // Saying so invites an argument the shop cannot win and warns anyone who
    // genuinely is. The ground is recorded internally; the email is neutral.
    const fraud = findCancellationReason('suspected_fraud');

    expect(fraud?.customerMessage.toLowerCase()).not.toContain('fraud');
    expect(fraud?.requiresNote).toBe(true);
  });

  it('expects a refund on the grounds where the shop is at fault', () => {
    expect(findCancellationReason('out_of_stock')?.refundExpected).toBe(true);
    expect(findCancellationReason('pricing_error')?.refundExpected).toBe(true);
    // Nothing arrived, so nothing goes back.
    expect(findCancellationReason('payment_not_received')?.refundExpected).toBe(false);
  });
});

describe('isCancellationCode', () => {
  it('accepts a known ground', () => {
    expect(isCancellationCode('out_of_stock')).toBe(true);
  });

  it('refuses anything else, including the shapes an untrusted body can carry', () => {
    expect(isCancellationCode('made_up')).toBe(false);
    expect(isCancellationCode('')).toBe(false);
    expect(isCancellationCode(null)).toBe(false);
    expect(isCancellationCode(undefined)).toBe(false);
    expect(isCancellationCode(7)).toBe(false);
    expect(isCancellationCode({ code: 'out_of_stock' })).toBe(false);
  });
});

describe('cancellationLabel', () => {
  it('names a known ground', () => {
    expect(cancellationLabel('out_of_stock')).toBe('We could not fulfil it');
  });

  it('falls back to the raw value, so an entry from a newer build still reads', () => {
    expect(cancellationLabel('written_by_a_later_deployment')).toBe('written_by_a_later_deployment');
  });

  it('says so when nothing was recorded', () => {
    expect(cancellationLabel(null)).toBe('No reason recorded');
  });
});

describe('cancellationMessage', () => {
  it('uses the ground’s own sentence', () => {
    expect(cancellationMessage('customer_changed_mind')).toBe(
      'We have cancelled this order as you asked. Nothing further is owed.'
    );
  });

  it('appends the admin’s note rather than replacing the sentence', () => {
    // The canonical sentence is the one that has been thought about; a hurried
    // note is rarely a replacement for it.
    const message = cancellationMessage('out_of_stock', 'The supplier let us down.');

    expect(message).toContain('not able to fulfil this order');
    expect(message.endsWith('The supplier let us down.')).toBe(true);
  });

  it('ignores a blank note', () => {
    expect(cancellationMessage('out_of_stock', '   ')).toBe(
      cancellationMessage('out_of_stock')
    );
  });

  it('falls back to the generic ground for a code it does not know', () => {
    expect(cancellationMessage('from_the_future')).toBe(
      findCancellationReason('other')!.customerMessage
    );
  });
});
