/**
 * The product_variants read layer.
 *
 * Two guards here matter more than the rest:
 *
 *   - `variantKeyFor` must produce byte-for-byte what the database's generated
 *     column produces. If they disagree, every lookup silently finds nothing
 *     and the app falls back to stale pricing_config numbers.
 *   - `PUBLIC_VARIANT_COLUMNS` must match the column-level GRANT in the
 *     migration. Grant a column here that the database withholds and every
 *     storefront query fails; withhold one the database grants and a field
 *     silently reads as undefined.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  variantKeyFor,
  variantLabel,
  variantsOf,
  hasVariantRows,
  findVariant,
  totalVariantStock,
  variantFacets,
  PUBLIC_VARIANT_COLUMNS,
  PUBLIC_VARIANTS_SELECT,
  type ProductVariant,
} from './product-variants';

const MIGRATION = readFileSync(
  join(process.cwd(), 'supabase/migrations/20251101002600_product_variants.sql'),
  'utf8'
);

const variant = (over: Partial<ProductVariant> = {}): ProductVariant => ({
  id: 'v1',
  product_id: 'p1',
  size: null,
  color: null,
  variant_key: 'single',
  price: 1000,
  stock: 5,
  image_url: null,
  is_active: true,
  ...over,
});

describe('variantKeyFor', () => {
  it('joins both axes with a pipe', () => {
    expect(variantKeyFor('1-2 months', 'red')).toBe('1-2 months|red');
  });

  it('uses the single axis alone when only one applies', () => {
    expect(variantKeyFor('S', null)).toBe('S');
    expect(variantKeyFor(null, 'red')).toBe('red');
  });

  it('is "single" when neither applies', () => {
    expect(variantKeyFor(null, null)).toBe('single');
    expect(variantKeyFor(undefined, undefined)).toBe('single');
    expect(variantKeyFor('', '')).toBe('single');
  });

  it('trims, so a stray space cannot create a second identity', () => {
    expect(variantKeyFor('  S  ', ' red ')).toBe('S|red');
    expect(variantKeyFor('   ', '   ')).toBe('single');
  });

  it('never produces a dangling separator', () => {
    // "S|" or "|red" would match no row in the database.
    for (const key of [variantKeyFor('S', ''), variantKeyFor('', 'red'), variantKeyFor('S', null)]) {
      expect(key.startsWith('|')).toBe(false);
      expect(key.endsWith('|')).toBe(false);
    }
  });
});

describe('variantKeyFor matches the database', () => {
  it('the database has exactly one definition of a key', () => {
    // It was five expressions before, with subtly different blank handling.
    // Any disagreement means a lookup silently matches nothing.
    expect(MIGRATION).toContain('CREATE OR REPLACE FUNCTION public.variant_key(p_size text, p_color text)');
    expect(MIGRATION).toContain('IMMUTABLE');
  });

  it('the generated column calls that function rather than inlining a copy', () => {
    expect(MIGRATION).toContain('variant_key text GENERATED ALWAYS AS (public.variant_key(size, color)) STORED');
  });

  it('every key derivation goes through the function', () => {
    const code = MIGRATION.replace(/--[^\n]*/g, '');
    // The only remaining concat_ws is for a human-readable label, which uses
    // ' / ' rather than '|'. A '|' join anywhere else would be a second,
    // divergent definition of a key.
    for (const match of code.matchAll(/concat_ws\(([^,]+),/g)) {
      expect(match[1].trim(), 'a key must be built by public.variant_key, not inline').not.toBe("'|'");
    }
  });

  it('the SQL branches match this function, blanks included', () => {
    const fn = MIGRATION.slice(
      MIGRATION.indexOf('FUNCTION public.variant_key'),
      MIGRATION.indexOf('COMMENT ON FUNCTION public.variant_key')
    );
    // Blank is treated as absent on both sides, so ' ' is not a new identity.
    expect(fn).toContain("btrim(p_size) || '|' || btrim(p_color)");
    expect(fn).toContain("ELSE 'single'");
    expect(variantKeyFor(' S ', ' red ')).toBe('S|red');
    expect(variantKeyFor(' ', ' ')).toBe('single');
  });
});

describe('PUBLIC_VARIANT_COLUMNS matches the GRANT', () => {
  const grantedColumns = (): string[] => {
    const grant = MIGRATION.slice(MIGRATION.indexOf('GRANT SELECT ('));
    const inner = grant.slice(grant.indexOf('(') + 1, grant.indexOf(')'));
    return inner.split(',').map((column) => column.trim()).sort();
  };

  it('grants exactly the columns the client asks for', () => {
    expect(grantedColumns()).toEqual([...PUBLIC_VARIANT_COLUMNS].sort());
  });

  it('never exposes cost or barcode to the browser', () => {
    for (const secret of ['cost', 'barcode']) {
      expect(grantedColumns(), `${secret} must not be granted to anon`).not.toContain(secret);
      expect([...PUBLIC_VARIANT_COLUMNS]).not.toContain(secret);
    }
  });

  it('the select literal lists the same columns as the array', () => {
    // The literal exists because the typed client parses it at the type level;
    // it can therefore drift from the array it documents.
    const inner = PUBLIC_VARIANTS_SELECT.slice(
      PUBLIC_VARIANTS_SELECT.indexOf('(') + 1,
      PUBLIC_VARIANTS_SELECT.lastIndexOf(')')
    );
    expect(inner.split(',').sort()).toEqual([...PUBLIC_VARIANT_COLUMNS].sort());
  });
});

describe('variantLabel', () => {
  it('reads as "size / colour"', () => {
    expect(variantLabel({ size: '1-2 months', color: 'red' })).toBe('1-2 months / red');
  });

  it('shows the single axis alone', () => {
    expect(variantLabel({ size: 'S', color: null })).toBe('S');
    expect(variantLabel({ size: null, color: 'red' })).toBe('red');
  });

  it('falls back to Standard rather than an empty label', () => {
    expect(variantLabel({ size: null, color: null })).toBe('Standard');
    expect(variantLabel({ size: '  ', color: '' })).toBe('Standard');
  });
});

describe('reading variants off a product', () => {
  it('treats a missing embed as no variants, without throwing', () => {
    expect(variantsOf(undefined)).toEqual([]);
    expect(variantsOf(null)).toEqual([]);
    expect(variantsOf({})).toEqual([]);
    expect(variantsOf({ product_variants: null })).toEqual([]);
    expect(hasVariantRows({})).toBe(false);
  });

  it('finds a variant by the same key the database uses', () => {
    const product = {
      product_variants: [
        variant({ variant_key: '1-2 months|red', size: '1-2 months', color: 'red', stock: 4 }),
        variant({ id: 'v2', variant_key: '3-5 months|brown', size: '3-5 months', color: 'brown', stock: 10 }),
      ],
    };
    expect(findVariant(product, '1-2 months', 'red')?.stock).toBe(4);
    expect(findVariant(product, '3-5 months', 'brown')?.id).toBe('v2');
  });

  it('resolves either key spelling for a lone variant, both directions', () => {
    // The old model called this variant 'single'; as a row it keys on its axes.
    const rowWithAxes = {
      product_variants: [variant({ variant_key: 'S|Multicolour', size: 'S', color: 'Multicolour', stock: 14 })],
    };
    // Product page before any selection -> asks for 'single'.
    expect(findVariant(rowWithAxes, null, null)?.stock).toBe(14);
    // And with the selection made.
    expect(findVariant(rowWithAxes, 'S', 'Multicolour')?.stock).toBe(14);

    // The other direction: a row with no axes, asked for with a selection.
    const rowWithoutAxes = { product_variants: [variant({ variant_key: 'single', stock: 9 })] };
    expect(findVariant(rowWithoutAxes, 'S', 'Multicolour')?.stock).toBe(9);
  });

  it('never substitutes one explicit selection for a different one', () => {
    // Two variants, and a selection matching neither. Returning either would
    // sell the wrong thing.
    const product = {
      product_variants: [
        variant({ variant_key: 'S|red', size: 'S', color: 'red' }),
        variant({ id: 'v2', variant_key: 'M|blue', size: 'M', color: 'blue' }),
      ],
    };
    expect(findVariant(product, 'S', 'blue')).toBeNull();
    expect(findVariant(product, null, null)).toBeNull();
  });

  it('returns null for a combination that is not sellable', () => {
    // The cartesian product of sizes and colours is not the variant set: this
    // product has 2 sizes and 2 colours but only 2 rows.
    const product = {
      product_variants: [
        variant({ variant_key: '1-2 months|red', size: '1-2 months', color: 'red' }),
        variant({ id: 'v2', variant_key: '3-5 months|brown', size: '3-5 months', color: 'brown' }),
      ],
    };
    expect(findVariant(product, '1-2 months', 'brown')).toBeNull();
  });

  it('sums only active variants for the total', () => {
    const product = {
      product_variants: [
        variant({ stock: 4 }),
        variant({ id: 'v2', variant_key: 'b', stock: 10 }),
        variant({ id: 'v3', variant_key: 'c', stock: 99, is_active: false }),
      ],
    };
    expect(totalVariantStock(product)).toBe(14);
  });

  it('reports the facets a JSONB blob could not be indexed for', () => {
    const product = {
      product_variants: [
        variant({ variant_key: 'S|red', size: 'S', color: 'red' }),
        variant({ id: 'v2', variant_key: 'M|red', size: 'M', color: 'red' }),
        variant({ id: 'v3', variant_key: 'L|blue', size: 'L', color: 'blue', is_active: false }),
      ],
    };
    const facets = variantFacets(product);
    expect(facets.sizes.sort()).toEqual(['M', 'S']);
    expect(facets.colors).toEqual(['red']);
  });
});
