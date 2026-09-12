/**
 * flattenProducts is the read interface for variants: the admin products table,
 * the stock page and the admin products API all consume its output.
 *
 * One flattened entry per product_variants row — the sole source of truth for
 * variant price/stock/images since pricing_config was dropped.
 *
 * The fixtures are the real production shapes, read out of the database.
 */
import { describe, it, expect } from 'vitest';
import { flattenProducts, type FlattenedProduct } from './product-flatten';
import { variantKeyFor } from './product-variants';

/** The real combination product from the live catalogue. */
const combinationProduct = {
  id: 'p-gown',
  name: 'Premium Baby Gown',
  category: 'babies',
  price: 13000,
  stock: 15,
  main_image: 'main.jpg',
  images: ['main.jpg'],
};

/** Attaches product_variants rows, exactly as the migration's backfill produces. */
const asVariantRows = (product: any, rows: Array<[string | null, string | null, number, number, string | null]>) => ({
  ...product,
  product_variants: rows.map(([size, color, price, stock, image_url], index) => ({
    id: `v${index}`,
    product_id: product.id,
    size,
    color,
    variant_key: variantKeyFor(size, color),
    price,
    stock,
    image_url,
    is_active: true,
  })),
});

describe('flattenProducts', () => {
  it('flattens a combination product, one entry per variant', () => {
    const entries = flattenProducts([
      asVariantRows(combinationProduct, [
        ['1-2 months', 'red', 13000, 4, 'red.jpg'],
        ['3-5 months', 'brown', 16000, 10, 'brown.jpg'],
        ['3-5 months', 'Yellow', 16500, 1, 'yellow.png'],
      ]),
    ]);

    expect(entries).toHaveLength(3);
    const byKey = new Map(entries.map((e) => [e.variantKey, e]));
    expect(byKey.get('1-2 months|red')?.price).toBe(13000);
    expect(byKey.get('3-5 months|brown')?.stock).toBe(10);
  });

  it('addresses a lone variant with a size and a colour by its axes, not "single"', () => {
    // An intentional behaviour of the row model: the old JSONB model called
    // every single-mode product 'single' even when it recorded a size and a
    // colour, so the key said nothing about what the variant was. Nothing
    // persists a variant key — it is derived per request and handed straight
    // back to set_variant_stock — so no stored data depends on the old
    // spelling. findVariant() resolves both, because the product page reads
    // stock before any selection is made.
    const single = { id: 'p-bracelet', name: 'Pickard Bracelet', category: 'accessories', price: 5000, stock: 14 };
    const [entry] = flattenProducts([asVariantRows(single, [['S', 'Multicolour', 5000, 14, null]])]);

    expect(entry.variantKey).toBe('S|Multicolour');
    expect(entry.price).toBe(5000);
    expect(entry.stock).toBe(14);
  });

  it('still keys a variant with no axes as "single"', () => {
    const bare = { id: 'p-bare', name: 'Bare', category: 'x', price: 100, stock: 3 };
    expect(flattenProducts([asVariantRows(bare, [[null, null, 100, 3, null]])])[0].variantKey).toBe('single');
  });

  it('produces no entries for a product with no variant rows', () => {
    // A query that didn't embed product_variants, or a product that somehow
    // has none — post-backfill this shouldn't happen, but an empty result is
    // the honest answer rather than fabricating a row.
    const bare = { id: 'p-bare', name: 'Bare', category: 'x', price: 100, stock: 2 };
    expect(flattenProducts([bare])).toHaveLength(0);
    expect(flattenProducts([{ ...bare, product_variants: [] }])).toHaveLength(0);
  });

  it('surfaces the variant id, sku and cost', () => {
    const withExtras = {
      ...combinationProduct,
      product_variants: [
        {
          id: 'v-real',
          product_id: 'p-gown',
          size: '1-2 months',
          color: 'red',
          variant_key: '1-2 months|red',
          price: 13000,
          stock: 4,
          image_url: 'red.jpg',
          is_active: true,
          sku: 'GOWN-12M-RED',
          cost: 8000,
        },
      ],
    };

    const [entry] = flattenProducts([withExtras]);
    expect(entry.variantId).toBe('v-real');
    expect(entry.sku).toBe('GOWN-12M-RED');
    expect(entry.cost).toBe(8000);
  });

  it('prefers the variant image over the product image, and flags it as its own', () => {
    const [entry] = flattenProducts([
      asVariantRows(combinationProduct, [['1-2 months', 'red', 13000, 4, 'red.jpg']]),
    ]);
    expect(entry.main_image).toBe('red.jpg');
    expect(entry.hasOwnImage).toBe(true);
  });

  it('falls back to the product image when the variant has none', () => {
    const [entry] = flattenProducts([
      asVariantRows(combinationProduct, [['1-2 months', 'red', 13000, 4, null]]),
    ]);
    expect(entry.main_image).toBe('main.jpg');
    expect(entry.hasOwnImage).toBe(false);
  });

  it('orders variants stably, so admin tables do not reshuffle', () => {
    const shuffled = asVariantRows(combinationProduct, [
      ['3-5 months', 'brown', 16000, 10, null],
      ['1-2 months', 'red', 13000, 4, null],
      ['3-5 months', 'Yellow', 16500, 1, null],
    ]);
    const keys = flattenProducts([shuffled]).map((entry: FlattenedProduct) => entry.variantKey);
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
  });
});
