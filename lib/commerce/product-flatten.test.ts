/**
 * flattenProducts is the read interface for variants: the admin products table,
 * the stock page and the admin products API all consume its output.
 *
 * Variants have moved from products.pricing_config into the product_variants
 * table, and this file is where both models meet. The tests that matter are the
 * equivalence ones — the same catalogue, expressed either way, must flatten to
 * the same thing. If it doesn't, the admin stock page shows different numbers
 * depending on whether the query happened to embed the rows.
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
  pricing_config: {
    mode: 'combination',
    colorImages: { red: 'red.jpg', brown: 'brown.jpg', Yellow: 'yellow.png' },
    combinationPrices: { '1-2 months|red': 13000, '3-5 months|brown': 16000, '3-5 months|Yellow': 16500 },
    combinationStock: { '1-2 months|red': 4, '3-5 months|brown': 10, '3-5 months|Yellow': 1 },
  },
};

/** The same product as rows, exactly as the migration's backfill produces. */
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

/** Compares only the fields both paths can populate. */
const comparable = (entry: FlattenedProduct) => ({
  id: entry.id,
  productId: entry.productId,
  variantKey: entry.variantKey,
  variantLabel: entry.variantLabel,
  price: entry.price,
  stock: entry.stock,
});

const byKey = (entries: FlattenedProduct[]) =>
  [...entries].sort((a, b) => a.variantKey.localeCompare(b.variantKey)).map(comparable);

describe('flattenProducts — the relational and JSONB models agree', () => {
  it('flattens a combination product identically either way', () => {
    const fromJson = flattenProducts([combinationProduct]);
    const fromRows = flattenProducts([
      asVariantRows(combinationProduct, [
        ['1-2 months', 'red', 13000, 4, 'red.jpg'],
        ['3-5 months', 'brown', 16000, 10, 'brown.jpg'],
        ['3-5 months', 'Yellow', 16500, 1, 'yellow.png'],
      ]),
    ]);

    expect(fromRows).toHaveLength(3);
    expect(byKey(fromRows)).toEqual(byKey(fromJson));
  });

  it('gives a lone variant the same price, stock and label either way', () => {
    // The KEY deliberately differs here — see the test below. Everything the
    // admin tables actually display is identical.
    const single = {
      id: 'p-bracelet',
      name: 'Pickard Bracelet',
      category: 'accessories',
      price: 5000,
      stock: 14,
      main_image: 'b.jpg',
      images: [],
      pricing_config: { mode: 'single', singleSize: 'S', singleColor: 'Multicolour', singleStock: 14 },
    };

    const [fromJson] = flattenProducts([single]);
    const [fromRows] = flattenProducts([asVariantRows(single, [['S', 'Multicolour', 5000, 14, null]])]);

    expect(fromRows.price).toBe(fromJson.price);
    expect(fromRows.stock).toBe(fromJson.stock);
    expect(fromRows.variantLabel).toBe(fromJson.variantLabel);
    expect(fromRows.size).toBe(fromJson.size);
    expect(fromRows.color).toBe(fromJson.color);
  });

  it('addresses a lone variant by its axes rather than as "single"', () => {
    // An intentional change. The JSONB model called every single-mode product
    // 'single' even when it recorded a size and a colour, so the key said
    // nothing about what the variant was. As a row it is addressed by what it
    // actually is. Nothing persists a variant key — it is derived per request
    // and handed straight back to set_variant_stock — so no stored data
    // depends on the old spelling. findVariant() resolves both, because the
    // product page reads stock before any selection is made.
    const single = {
      id: 'p-bracelet',
      name: 'Pickard Bracelet',
      category: 'accessories',
      price: 5000,
      stock: 14,
      pricing_config: { mode: 'single', singleSize: 'S', singleColor: 'Multicolour', singleStock: 14 },
    };

    expect(flattenProducts([single])[0].variantKey).toBe('single');
    expect(flattenProducts([asVariantRows(single, [['S', 'Multicolour', 5000, 14, null]])])[0].variantKey)
      .toBe('S|Multicolour');
  });

  it('still keys a variant with no axes as "single"', () => {
    const bare = { id: 'p-bare', name: 'Bare', category: 'x', price: 100, stock: 3 };
    expect(flattenProducts([asVariantRows(bare, [[null, null, 100, 3, null]])])[0].variantKey).toBe('single');
  });

  it('flattens a size-only product identically', () => {
    const sized = {
      id: 'p-sized',
      name: 'Sized Thing',
      category: 'kids',
      price: 2000,
      stock: 7,
      pricing_config: { mode: 'size', sizePrices: { S: 2000, M: 2500 }, sizeStock: { S: 3, M: 4 } },
    };

    expect(byKey(flattenProducts([asVariantRows(sized, [['S', null, 2000, 3, null], ['M', null, 2500, 4, null]])])))
      .toEqual(byKey(flattenProducts([sized])));
  });

  it('flattens a colour-only product identically', () => {
    const coloured = {
      id: 'p-coloured',
      name: 'Coloured Thing',
      category: 'kids',
      price: 3000,
      stock: 9,
      pricing_config: {
        mode: 'color',
        colorPrices: { red: 3000, blue: 3200 },
        colorStock: { red: 5, blue: 4 },
        colorImages: { red: 'r.jpg', blue: 'b.jpg' },
      },
    };

    expect(byKey(flattenProducts([asVariantRows(coloured, [[null, 'red', 3000, 5, 'r.jpg'], [null, 'blue', 3200, 4, 'b.jpg']])])))
      .toEqual(byKey(flattenProducts([coloured])));
  });
});

describe('flattenProducts — the relational path adds what JSONB could not carry', () => {
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

  it('prefers the variant image over the product image', () => {
    const [entry] = flattenProducts([
      asVariantRows(combinationProduct, [['1-2 months', 'red', 13000, 4, 'red.jpg']]),
    ]);
    expect(entry.main_image).toBe('red.jpg');
  });

  it('falls back to the product image when the variant has none', () => {
    const [entry] = flattenProducts([
      asVariantRows(combinationProduct, [['1-2 months', 'red', 13000, 4, null]]),
    ]);
    expect(entry.main_image).toBe('main.jpg');
  });

  it('orders variants stably, so admin tables do not reshuffle', () => {
    const shuffled = asVariantRows(combinationProduct, [
      ['3-5 months', 'brown', 16000, 10, null],
      ['1-2 months', 'red', 13000, 4, null],
      ['3-5 months', 'Yellow', 16500, 1, null],
    ]);
    const keys = flattenProducts([shuffled]).map((entry) => entry.variantKey);
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
  });
});

describe('flattenProducts — the fallback is still reachable', () => {
  it('uses pricing_config when the embed is absent', () => {
    // A query that does not ask for product_variants returns products without
    // them; that must render, not blank out.
    expect(flattenProducts([combinationProduct])).toHaveLength(3);
  });

  it('uses pricing_config when the embed is present but empty', () => {
    // An empty array is indistinguishable from "not loaded" at the type level,
    // so the fallback covers it rather than showing a product with no variants.
    expect(flattenProducts([{ ...combinationProduct, product_variants: [] }])).toHaveLength(3);
  });

  it('produces a Standard entry for a product with no variant data at all', () => {
    const bare = { id: 'p-bare', name: 'Bare', category: 'x', price: 100, stock: 2 };
    const [entry] = flattenProducts([bare]);
    expect(entry.variantKey).toBe('single');
    expect(entry.variantLabel).toBe('Standard');
    expect(entry.stock).toBe(2);
  });
});
