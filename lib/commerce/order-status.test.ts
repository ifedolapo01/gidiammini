/**
 * The order status machine. getStatusOptions drives what an admin can pick,
 * hasStockReserved decides whether a transition moves inventory, and the two
 * can* helpers gate what a customer may request.
 *
 * hasStockReserved changed meaning in the stock-reservation work: 'pending' now
 * holds stock, because stock is claimed at checkout rather than at confirmation.
 * These tests pin that, since getting it wrong double-decrements or releases
 * stock that was never taken.
 */
import { describe, it, expect } from 'vitest';
import {
  ORDER_STATUSES, INITIAL_ORDER_STATUS, REVENUE_STATUSES,
  formatOrderStatus, formatCustomerStatusLabel, getStatusOptions,
  hasStockReserved, canRequestOrderChange, canCancelOrder, getStatusColorToken,
  commonStatusOptions,
} from './order-status';
import type { OrderStatus } from '@/types/order';

describe('the canonical status list', () => {
  it('starts at pending', () => {
    expect(INITIAL_ORDER_STATUS).toBe('pending');
    expect(ORDER_STATUSES[0]).toBe('pending');
  });

  it('puts cancelled last, so it stays reachable from anywhere', () => {
    expect(ORDER_STATUSES[ORDER_STATUSES.length - 1]).toBe('cancelled');
  });

  it('counts neither pending nor cancelled toward revenue', () => {
    expect(REVENUE_STATUSES).not.toContain('pending');
    expect(REVENUE_STATUSES).not.toContain('cancelled');
    expect(REVENUE_STATUSES).toContain('delivered');
    expect(REVENUE_STATUSES).toContain('picked_up');
  });
});

describe('hasStockReserved', () => {
  it('is true for pending — stock is claimed at checkout, not at confirmation', () => {
    expect(hasStockReserved('pending')).toBe(true);
  });

  it('is false only for cancelled', () => {
    expect(hasStockReserved('cancelled')).toBe(false);
    for (const status of ORDER_STATUSES.filter((s) => s !== 'cancelled')) {
      expect(hasStockReserved(status)).toBe(true);
    }
  });
});

describe('getStatusOptions', () => {
  it('never offers pending — every order starts there automatically', () => {
    for (const status of ORDER_STATUSES) {
      expect(getStatusOptions(status, 'delivery')).not.toContain('pending');
      expect(getStatusOptions(status, 'pickup')).not.toContain('pending');
    }
  });

  it('is forward-only: a status already passed is never offered again', () => {
    const options = getStatusOptions('shipped', 'delivery');
    expect(options).not.toContain('confirmed');
    expect(options).not.toContain('rescheduled');
    expect(options).toContain('delivered');
  });

  it('hides delivery-only statuses from a pickup order', () => {
    const options = getStatusOptions('confirmed', 'pickup');
    expect(options).not.toContain('shipped');
    expect(options).not.toContain('delivered');
    expect(options).toContain('ready_for_pickup');
    expect(options).toContain('picked_up');
  });

  it('hides pickup-only statuses from a delivery order', () => {
    const options = getStatusOptions('confirmed', 'delivery');
    expect(options).not.toContain('ready_for_pickup');
    expect(options).not.toContain('picked_up');
    expect(options).toContain('shipped');
  });

  it('keeps cancelled available from any non-terminal status', () => {
    for (const status of ['pending', 'confirmed', 'rescheduled', 'shipped'] as OrderStatus[]) {
      expect(getStatusOptions(status, 'delivery')).toContain('cancelled');
    }
  });

  it('offers nothing from a terminal status', () => {
    expect(getStatusOptions('delivered', 'delivery')).toEqual([]);
    expect(getStatusOptions('cancelled', 'delivery')).toEqual([]);
  });

  it('offers the full forward path from pending', () => {
    expect(getStatusOptions('pending', 'delivery')).toEqual(['confirmed', 'rescheduled', 'shipped', 'delivered', 'cancelled']);
  });
});

describe('canRequestOrderChange', () => {
  it('allows a change while the order has not physically moved', () => {
    expect(canRequestOrderChange('pending')).toBe(true);
    expect(canRequestOrderChange('confirmed')).toBe(true);
    expect(canRequestOrderChange('rescheduled')).toBe(true);
  });

  it('blocks a change once it has shipped or is staged for pickup', () => {
    expect(canRequestOrderChange('shipped')).toBe(false);
    expect(canRequestOrderChange('ready_for_pickup')).toBe(false);
    expect(canRequestOrderChange('picked_up')).toBe(false);
    expect(canRequestOrderChange('delivered')).toBe(false);
    expect(canRequestOrderChange('cancelled')).toBe(false);
  });
});

describe('canCancelOrder', () => {
  it('is deliberately more permissive than canRequestOrderChange', () => {
    // A pickup order staged for collection has not left the building, so the
    // customer can still back out — unlike a reschedule request.
    expect(canRequestOrderChange('ready_for_pickup')).toBe(false);
    expect(canCancelOrder('ready_for_pickup')).toBe(true);
  });

  it('blocks cancellation once the goods are gone', () => {
    expect(canCancelOrder('shipped')).toBe(false);
    expect(canCancelOrder('picked_up')).toBe(false);
    expect(canCancelOrder('delivered')).toBe(false);
    expect(canCancelOrder('cancelled')).toBe(false);
  });
});

describe('label formatting', () => {
  it('title-cases snake_case statuses', () => {
    expect(formatOrderStatus('ready_for_pickup')).toBe('Ready For Pickup');
    expect(formatOrderStatus('pending')).toBe('Pending');
  });

  it('never shows a customer a bare "Pending" — they have already paid', () => {
    expect(formatCustomerStatusLabel('pending')).toBe('Payment Verification Pending');
    expect(formatCustomerStatusLabel('shipped')).toBe('Shipped');
  });
});

describe('getStatusColorToken', () => {
  it('returns a token for every status, so no status renders unstyled', () => {
    for (const status of ORDER_STATUSES) {
      expect(getStatusColorToken(status)).toBeTruthy();
    }
  });

  it('groups related outcomes into the same hue family', () => {
    expect(getStatusColorToken('picked_up')).toBe(getStatusColorToken('delivered'));
    expect(getStatusColorToken('cancelled')).toBe('destructive');
  });
});

describe('commonStatusOptions', () => {
  it('offers what a whole delivery batch can move to', () => {
    expect(
      commonStatusOptions([
        { status: 'confirmed', delivery_option: 'delivery' },
        { status: 'confirmed', delivery_option: 'delivery' },
      ])
    ).toContain('shipped');
  });

  it('drops anything one of the orders has already passed', () => {
    // A batch mixing confirmed and shipped orders cannot go back to shipped.
    const options = commonStatusOptions([
      { status: 'confirmed', delivery_option: 'delivery' },
      { status: 'shipped', delivery_option: 'delivery' },
    ]);

    expect(options).not.toContain('shipped');
    expect(options).toContain('delivered');
  });

  it('offers nothing for a mix of pickup and delivery beyond cancelling', () => {
    expect(
      commonStatusOptions([
        { status: 'confirmed', delivery_option: 'delivery' },
        { status: 'confirmed', delivery_option: 'pickup' },
      ])
    ).toEqual(['rescheduled', 'cancelled']);
  });

  it('offers nothing once any selected order is finished', () => {
    expect(
      commonStatusOptions([
        { status: 'confirmed', delivery_option: 'delivery' },
        { status: 'delivered', delivery_option: 'delivery' },
      ])
    ).toEqual([]);
  });

  it('offers nothing for an empty selection', () => {
    expect(commonStatusOptions([])).toEqual([]);
  });
});
