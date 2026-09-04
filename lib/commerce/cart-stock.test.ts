/**
 * The cart page and the checkout gate both decide "is this still buyable?"
 * from these functions, so what they answer has to be exact: a line the
 * catalogue no longer carries reads differently from one that hit zero, and a
 * line nobody has checked yet must not be reported as sold out.
 */
import { describe, it, expect } from 'vitest';
import {
  cartStockSnapshot,
  findCartStockIssues,
  describeStockShortage,
  PRODUCT_GONE,
  type CartStockProduct,
} from './cart-stock';
import { cartLineKey } from './cart-input';
import { product, variant } from './product-fixtures';
import type { CartItem } from '@/types/order';

function line(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: 'p1',
    name: 'Ribbed Bodysuit',
    price: 5000,
    quantity: 1,
    image: 'https://cdn.example/main.jpg',
    size: 'S',
    color: 'red',
    ...overrides,
  };
}

function catalogue(overrides: Partial<CartStockProduct> = {}): CartStockProduct[] {
  return [
    {
      ...product({ id: 'p1', product_variants: [variant({ product_id: 'p1', stock: 3 })] }),
      ...overrides,
    } as CartStockProduct,
  ];
}

describe('cartStockSnapshot', () => {
  it('reads the variant row for the selection', () => {
    const items = [line()];
    expect(cartStockSnapshot(items, catalogue()).get(cartLineKey('p1', 'S', 'red'))).toBe(3);
  });

  it('keys variants of one product separately', () => {
    const items = [line({ size: 'S' }), line({ size: 'M' })];
    const products = catalogue({
      product_variants: [
        variant({ id: 'v1', product_id: 'p1', size: 'S', variant_key: 'S|red', stock: 3 }),
        variant({ id: 'v2', product_id: 'p1', size: 'M', variant_key: 'M|red', stock: 0 }),
      ],
    });

    const snapshot = cartStockSnapshot(items, products);
    expect(snapshot.get(cartLineKey('p1', 'S', 'red'))).toBe(3);
    expect(snapshot.get(cartLineKey('p1', 'M', 'red'))).toBe(0);
  });

  it('marks a product missing from the catalogue as gone', () => {
    const snapshot = cartStockSnapshot([line({ productId: 'deleted' })], catalogue());
    expect(snapshot.get(cartLineKey('deleted', 'S', 'red'))).toBe(PRODUCT_GONE);
  });
});

describe('findCartStockIssues', () => {
  const key = cartLineKey('p1', 'S', 'red');

  it('passes a line with enough stock', () => {
    expect(findCartStockIssues([line({ quantity: 3 })], new Map([[key, 3]]))).toEqual([]);
  });

  it('reports a line asking for more than is left', () => {
    const issues = findCartStockIssues([line({ quantity: 4 })], new Map([[key, 3]]));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ key, quantity: 4, available: 3 });
  });

  it('says nothing about a line the snapshot has not covered', () => {
    // The cart page renders before its stock read returns; an unchecked line
    // must not be flagged in the meantime.
    expect(findCartStockIssues([line()], new Map())).toEqual([]);
  });

  it('reports every failing line, not just the first', () => {
    const items = [line({ size: 'S', quantity: 2 }), line({ size: 'M', quantity: 2 })];
    const snapshot = new Map([
      [cartLineKey('p1', 'S', 'red'), 0],
      [cartLineKey('p1', 'M', 'red'), 1],
    ]);
    expect(findCartStockIssues(items, snapshot)).toHaveLength(2);
  });
});

describe('describeStockShortage', () => {
  const base = { name: 'Ribbed Bodysuit', size: 'S', color: 'red' };

  it('distinguishes gone, sold out, and partially available', () => {
    expect(describeStockShortage({ ...base, available: PRODUCT_GONE })).toBe(
      'Ribbed Bodysuit (S / red) is no longer available.'
    );
    expect(describeStockShortage({ ...base, available: 0 })).toBe(
      'Ribbed Bodysuit (S / red) has just sold out.'
    );
    expect(describeStockShortage({ ...base, available: 2 })).toBe(
      'Only 2 left of Ribbed Bodysuit (S / red).'
    );
  });

  it('omits the parenthetical for a product with no variant selection', () => {
    expect(describeStockShortage({ name: 'Gift Card', size: null, color: null, available: 0 })).toBe(
      'Gift Card has just sold out.'
    );
  });
});
