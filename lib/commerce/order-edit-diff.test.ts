import { describe, expect, it } from 'vitest';
import {
  describeLine,
  describeLineChange,
  diffOrderLines,
  isEmptyLineDiff,
  type OrderLine,
} from './order-edit-diff';

const line = (overrides: Partial<OrderLine> = {}): OrderLine => ({
  product_id: 'p1',
  product_name: 'Cotton Gown',
  price: 5_000,
  quantity: 1,
  size: '0-3m',
  color: 'Red',
  ...overrides,
});

describe('describeLine', () => {
  it('names the variant in brackets', () => {
    expect(describeLine(line())).toBe('Cotton Gown (0-3m / Red)');
  });

  it('omits the bracket entirely when there is no variant', () => {
    expect(describeLine(line({ size: null, color: null }))).toBe('Cotton Gown');
  });

  it('uses whichever half of the variant exists', () => {
    expect(describeLine(line({ color: null }))).toBe('Cotton Gown (0-3m)');
    expect(describeLine(line({ size: null }))).toBe('Cotton Gown (Red)');
  });
});

describe('diffOrderLines', () => {
  it('reports nothing when the lines are unchanged', () => {
    expect(isEmptyLineDiff(diffOrderLines([line()], [line()]))).toBe(true);
  });

  it('does not treat a reordered set as a change', () => {
    // The editor rebuilds the array on every keystroke, so position is not
    // information. A diff keyed on index would report every edit as a rewrite.
    const a = line();
    const b = line({ product_id: 'p2', product_name: 'Wrap Dress' });

    expect(isEmptyLineDiff(diffOrderLines([a, b], [b, a]))).toBe(true);
  });

  it('reports an added line with its quantity', () => {
    const changes = diffOrderLines([], [line({ quantity: 2 })]);

    expect(changes).toEqual([
      { kind: 'added', label: 'Cotton Gown (0-3m / Red)', to: 2 },
    ]);
  });

  it('reports a removed line', () => {
    const changes = diffOrderLines([line({ quantity: 3 })], [line({ product_id: 'p2', product_name: 'Other' })]);

    expect(changes[0]).toEqual({ kind: 'removed', label: 'Cotton Gown (0-3m / Red)', from: 3 });
  });

  it('reports a quantity change on a line that stayed', () => {
    const changes = diffOrderLines([line({ quantity: 1 })], [line({ quantity: 4 })]);

    expect(changes).toEqual([
      { kind: 'quantity', label: 'Cotton Gown (0-3m / Red)', from: 1, to: 4 },
    ]);
  });

  it('reports a price change separately from a quantity change', () => {
    const changes = diffOrderLines([line()], [line({ quantity: 2, price: 4_500 })]);

    expect(changes.map((change) => change.kind)).toEqual(['quantity', 'price']);
  });

  it('treats a colour swap as a removal and an addition, not an edit', () => {
    // Different variant, different unit of stock. Reporting it as "colour
    // changed" would hide that one item went back on the shelf and another
    // came off it.
    const changes = diffOrderLines([line({ color: 'Red' })], [line({ color: 'Blue' })]);

    expect(changes.map((change) => change.kind)).toEqual(['removed', 'added']);
  });

  it('folds two lines for the same variant into one quantity', () => {
    const changes = diffOrderLines([line({ quantity: 5 })], [line({ quantity: 3 }), line({ quantity: 2 })]);

    expect(isEmptyLineDiff(changes)).toBe(true);
  });

  it('matches lines with no product id by name, so a deleted product still diffs', () => {
    const orphan = line({ product_id: null });

    expect(isEmptyLineDiff(diffOrderLines([orphan], [orphan]))).toBe(true);
    expect(diffOrderLines([orphan], [{ ...orphan, quantity: 2 }])[0].kind).toBe('quantity');
  });

  it('lists removals before additions, so a swap reads in the order it happened', () => {
    const changes = diffOrderLines(
      [line({ color: 'Red' })],
      [line({ color: 'Blue' })]
    );

    expect(changes[0].kind).toBe('removed');
    expect(changes[1].kind).toBe('added');
  });
});

describe('describeLineChange', () => {
  it('writes each kind as a sentence a customer can read', () => {
    expect(describeLineChange({ kind: 'added', label: 'Gown', to: 2 })).toBe('Added 2 × Gown');
    expect(describeLineChange({ kind: 'removed', label: 'Gown' })).toBe('Removed Gown');
    expect(describeLineChange({ kind: 'quantity', label: 'Gown', from: 1, to: 3 })).toBe(
      'Gown: quantity changed from 1 to 3'
    );
    expect(describeLineChange({ kind: 'price', label: 'Gown', from: 5000, to: 4500 })).toBe(
      'Gown: price changed from 5000 to 4500'
    );
  });
});
