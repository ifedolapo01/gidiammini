import { describe, expect, it } from 'vitest';
import { describeBalance, orderChargeLines, orderSettlement, type OrderMoney } from './order-money';

const order = (overrides: Partial<OrderMoney> = {}): OrderMoney => ({
  items_subtotal: 20_000,
  tax_amount: 1_500,
  shipping_amount: 3_000,
  discount_amount: 0,
  total_amount: 24_500,
  amount_paid: 0,
  amount_refunded: 0,
  delivery_option: 'delivery',
  ...overrides,
});

describe('orderChargeLines', () => {
  it('ends on the total, whatever else is present', () => {
    const lines = orderChargeLines(order());

    expect(lines.at(-1)).toEqual({ label: 'Total', amount: 24_500, kind: 'total' });
  });

  it('omits a zero tax line rather than printing ₦0', () => {
    const labels = orderChargeLines(order({ tax_amount: 0 })).map((line) => line.label);

    expect(labels).not.toContain('Tax');
  });

  it('omits delivery on an order that has no delivery fee', () => {
    const labels = orderChargeLines(order({ shipping_amount: 0 })).map((line) => line.label);

    expect(labels).not.toContain('Delivery');
  });

  it('calls the fee "Handling" on a pickup order', () => {
    const labels = orderChargeLines(
      order({ delivery_option: 'pickup', shipping_amount: 500 })
    ).map((line) => line.label);

    expect(labels).toContain('Handling');
    expect(labels).not.toContain('Delivery');
  });

  it('shows a discount as a negative credit line, naming its reason', () => {
    const lines = orderChargeLines(
      order({ discount_amount: 2_000, discount_reason: 'late delivery', total_amount: 22_500 })
    );
    const discount = lines.find((line) => line.kind === 'credit');

    expect(discount).toEqual({ label: 'Discount — late delivery', amount: -2_000, kind: 'credit' });
  });

  it('keeps the items line even when everything else is absent', () => {
    const lines = orderChargeLines({ items_subtotal: 0, total_amount: 0 });

    expect(lines.map((line) => line.label)).toEqual(['Items', 'Total']);
  });
});

describe('orderSettlement', () => {
  it('reports an unpaid order as owing its whole total', () => {
    const result = orderSettlement(order());

    expect(result.balance).toBe(24_500);
    expect(result.settled).toBe(false);
    expect(result.overpaid).toBe(false);
  });

  it('nets refunds off what was received', () => {
    const result = orderSettlement(order({ amount_paid: 24_500, amount_refunded: 4_500 }));

    expect(result.net).toBe(20_000);
    expect(result.balance).toBe(4_500);
  });

  it('reports a fully paid order as settled with a zero balance', () => {
    const result = orderSettlement(order({ amount_paid: 24_500 }));

    expect(result.balance).toBe(0);
    expect(result.settled).toBe(true);
    expect(result.overpaid).toBe(false);
  });

  it('reports an overpayment as a negative balance rather than clamping it', () => {
    // The figure is what has to be sent back, so losing the sign would lose
    // the refund.
    const result = orderSettlement(order({ amount_paid: 25_000 }));

    expect(result.balance).toBe(-500);
    expect(result.overpaid).toBe(true);
  });

  it('rounds to kobo, so two numeric columns do not produce a floating-point tail', () => {
    const result = orderSettlement(order({ total_amount: 100, amount_paid: 0.1, amount_refunded: 0.2 }));

    expect(result.net).toBe(-0.1);
    expect(result.balance).toBe(100.1);
  });

  it('treats missing payment columns as zero rather than NaN', () => {
    const result = orderSettlement({ total_amount: 1_000 });

    expect(result.paid).toBe(0);
    expect(result.balance).toBe(1_000);
  });
});

describe('describeBalance', () => {
  it('says nothing about an order nobody has paid anything towards', () => {
    expect(describeBalance(order())).toBeNull();
  });

  it('names the outstanding balance on a part payment', () => {
    expect(describeBalance(order({ amount_paid: 20_000 }))).toBe('4500.00 still outstanding.');
  });

  it('names the amount owed back on an overpayment', () => {
    expect(describeBalance(order({ amount_paid: 25_000 }))).toBe(
      'Overpaid by 500.00 — a refund is owed.'
    );
  });

  it('says so plainly when the order is square', () => {
    expect(describeBalance(order({ amount_paid: 24_500 }))).toBe('Fully paid.');
  });
});
