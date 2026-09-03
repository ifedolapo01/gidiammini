import { describe, it, expect } from 'vitest';
import { getStockStatus, isRestock } from './stock';

describe('getStockStatus', () => {
  it('classifies the three levels', () => {
    expect(getStockStatus(0).level).toBe('out');
    expect(getStockStatus(-3).level).toBe('out');
    expect(getStockStatus(3).level).toBe('low');
    expect(getStockStatus(50).level).toBe('in');
  });

  it('honours a custom low threshold', () => {
    expect(getStockStatus(8, 10).level).toBe('low');
    expect(getStockStatus(8, 5).level).toBe('in');
  });
});

describe('isRestock', () => {
  it('fires only when something unbuyable became buyable', () => {
    expect(isRestock(0, 5)).toBe(true);
    expect(isRestock(null, 1)).toBe(true);
    expect(isRestock(undefined, 1)).toBe(true);
  });

  it('does not fire on a top-up — 4 to 6 restocks nothing', () => {
    expect(isRestock(4, 6)).toBe(false);
  });

  it('does not fire on a sell-out or a no-op', () => {
    expect(isRestock(5, 0)).toBe(false);
    expect(isRestock(0, 0)).toBe(false);
  });
});
