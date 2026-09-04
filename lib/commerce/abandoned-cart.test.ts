/**
 * The rules that decide whether a stranger gets an email.
 *
 * This is the most consequential logic in the recovery feature, and none of it
 * is visible on a screen — so it is tested directly. A bug here does not
 * render wrong, it mails somebody who asked not to be mailed, or mails them a
 * third time, or mails them after they have already paid.
 */
import { describe, it, expect } from 'vitest';
import {
  dueReminder,
  sanitiseCartItems,
  shouldRestartSequence,
  MAX_CART_ITEMS,
  type AbandonedCartState,
} from './abandoned-cart';

const NOW = new Date('2026-09-04T12:00:00.000Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();
const daysAgo = (days: number) => hoursAgo(days * 24);

const state = (over: Partial<AbandonedCartState> = {}): AbandonedCartState => ({
  abandoned_at: hoursAgo(2),
  first_sent_at: null,
  second_sent_at: null,
  recovered_at: null,
  opted_out: false,
  ...over,
});

const id = (n: number) => `1111111${n}-1111-4111-8111-111111111111`;

describe('dueReminder — the permanent stops', () => {
  it('never mails somebody who asked not to be', () => {
    // Even with everything else screaming "send": idle for a week, nothing
    // sent yet.
    expect(dueReminder(state({ opted_out: true, abandoned_at: daysAgo(7) }), NOW)).toBeNull();
  });

  it('never mails somebody who has already bought', () => {
    expect(dueReminder(state({ recovered_at: hoursAgo(1), abandoned_at: daysAgo(2) }), NOW)).toBeNull();
  });

  it('never sends a third', () => {
    expect(
      dueReminder(
        state({ first_sent_at: daysAgo(3), second_sent_at: daysAgo(2), abandoned_at: daysAgo(4) }),
        NOW
      )
    ).toBeNull();
  });
});

describe('dueReminder — timing', () => {
  it('waits an hour before the first', () => {
    expect(dueReminder(state({ abandoned_at: hoursAgo(0.5) }), NOW)).toBeNull();
    expect(dueReminder(state({ abandoned_at: hoursAgo(1) }), NOW)).toBe('first');
  });

  it('does not fire while somebody is still shopping', () => {
    // The clock runs from when the cart was last seen, so editing the basket
    // pushes it forward. Otherwise the "you left this behind" email lands
    // while they are still choosing sizes.
    expect(dueReminder(state({ abandoned_at: hoursAgo(0.1) }), NOW)).toBeNull();
  });

  it('waits a day before the second, measured from abandonment', () => {
    const sentLate = state({ abandoned_at: hoursAgo(20), first_sent_at: hoursAgo(2) });
    expect(dueReminder(sentLate, NOW)).toBeNull();

    const due = state({ abandoned_at: hoursAgo(24), first_sent_at: hoursAgo(22) });
    expect(dueReminder(due, NOW)).toBe('second');
  });

  it('does not let a late first email drag the second out with it', () => {
    // First went out 23 hours late; the second is still due on the cart's
    // own clock rather than 24 hours after that.
    const late = state({ abandoned_at: daysAgo(2), first_sent_at: hoursAgo(1) });
    expect(dueReminder(late, NOW)).toBe('second');
  });
});

describe('shouldRestartSequence', () => {
  it('does not restart what never started', () => {
    expect(shouldRestartSequence({ first_sent_at: null, second_sent_at: null, recovered_at: null }, NOW)).toBe(
      false
    );
  });

  it('does not restart a sequence that is still recent', () => {
    // The shopper who comes back next day must not get a second first-email.
    expect(
      shouldRestartSequence({ first_sent_at: hoursAgo(20), second_sent_at: null, recovered_at: null }, NOW)
    ).toBe(false);
  });

  it('restarts once the last contact is genuinely old', () => {
    expect(
      shouldRestartSequence({ first_sent_at: daysAgo(30), second_sent_at: daysAgo(29), recovered_at: null }, NOW)
    ).toBe(true);
  });

  it('counts a purchase as contact, so a recent buyer is not re-sequenced', () => {
    expect(
      shouldRestartSequence({ first_sent_at: daysAgo(40), second_sent_at: null, recovered_at: daysAgo(1) }, NOW)
    ).toBe(false);
  });
});

describe('sanitiseCartItems', () => {
  it('keeps well-formed lines', () => {
    expect(
      sanitiseCartItems([{ product_id: id(1), size: 'S', color: 'red', quantity: 2 }])
    ).toEqual([{ product_id: id(1), size: 'S', color: 'red', quantity: 2 }]);
  });

  it('drops anything that is not a real product id', () => {
    // The endpoint is public and reads localStorage, which the shopper owns.
    expect(sanitiseCartItems([{ product_id: 'nope', quantity: 1 }, null, 'x', 7])).toEqual([]);
  });

  it('collapses the same variant sent twice', () => {
    const twice = sanitiseCartItems([
      { product_id: id(1), size: 'S', color: null, quantity: 1 },
      { product_id: id(1), size: 'S', color: null, quantity: 5 },
    ]);
    expect(twice).toHaveLength(1);
  });

  it('keeps two sizes of the same product as two lines', () => {
    const both = sanitiseCartItems([
      { product_id: id(1), size: 'S', color: null, quantity: 1 },
      { product_id: id(1), size: 'M', color: null, quantity: 1 },
    ]);
    expect(both).toHaveLength(2);
  });

  it('clamps the quantity, so no email claims a basket nobody had', () => {
    expect(sanitiseCartItems([{ product_id: id(1), quantity: 9000 }])[0].quantity).toBe(99);
    expect(sanitiseCartItems([{ product_id: id(1), quantity: 0 }])[0].quantity).toBe(1);
    expect(sanitiseCartItems([{ product_id: id(1), quantity: 'many' }])[0].quantity).toBe(1);
  });

  it('caps how many lines one capture may carry', () => {
    const many = Array.from({ length: MAX_CART_ITEMS + 10 }, (_unused, index) => ({
      product_id: `${String(index).padStart(8, '0')}-1111-4111-8111-111111111111`,
      quantity: 1,
    }));
    expect(sanitiseCartItems(many)).toHaveLength(MAX_CART_ITEMS);
  });

  it('treats a blank size or colour as absent rather than as an empty string', () => {
    const [item] = sanitiseCartItems([{ product_id: id(1), size: '  ', color: '', quantity: 1 }]);
    expect(item.size).toBeNull();
    expect(item.color).toBeNull();
  });
});
