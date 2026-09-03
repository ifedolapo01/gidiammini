/**
 * What a product save writes.
 *
 * These exist because of real data loss. A verification script sent
 * `{id, name, price, main_image, category}` to the admin product PUT and the
 * route cleared everything else — sizes, colours, stock, sub-category — because
 * it built a whole row and defaulted every absent field. The admin form always
 * submits everything, so nothing had ever caught it.
 *
 * The first block is therefore the important one: an omitted field must not
 * appear in an update payload at all.
 */
import { describe, it, expect } from 'vitest';
import { buildProductCreatePayload, buildProductUpdatePayload } from './product-payload';

describe('buildProductUpdatePayload — omitted means "leave alone"', () => {
  it('includes only the fields the body mentioned', () => {
    const payload = buildProductUpdatePayload({
      id: 'p1',
      name: 'Pickard Bracelet',
      price: 5500,
    });

    expect(Object.keys(payload).sort()).toEqual(['name', 'price', 'updated_at']);
  });

  it('does not clear the fields that were wiped in the incident', () => {
    const payload = buildProductUpdatePayload({ id: 'p1', name: 'X', price: 1, category: 'kids' });

    for (const field of ['sizes', 'colors', 'stock', 'sub_category', 'main_image', 'pricing_config', 'images', 'details']) {
      expect(payload, `${field} must be absent, not defaulted`).not.toHaveProperty(field);
    }
  });

  it('never writes the id, which addresses the row rather than being a column', () => {
    expect(buildProductUpdatePayload({ id: 'p1', name: 'X' })).not.toHaveProperty('id');
  });

  it('always advances updated_at', () => {
    expect(buildProductUpdatePayload({})).toHaveProperty('updated_at');
  });

  it('writes a field the caller deliberately emptied', () => {
    // Explicitly sending [] means "remove them"; that must still work.
    const payload = buildProductUpdatePayload({ sizes: [], colors: [] });
    expect(payload.sizes).toEqual([]);
    expect(payload.colors).toEqual([]);
  });

  it('writes an explicit null sub_category', () => {
    expect(buildProductUpdatePayload({ sub_category: null }).sub_category).toBeNull();
  });
});

describe('buildProductCreatePayload — absent means "use a default"', () => {
  it('fills in every column for a new row', () => {
    const payload = buildProductCreatePayload({ name: 'New', price: 100 });

    expect(payload).toMatchObject({
      name: 'New',
      price: 100,
      description: '',
      category: 'babies',
      main_image: '',
      images: [],
      colors: [],
      sizes: [],
      sizing_type: 'size',
      details: [],
      sub_category: null,
      pricing_config: null,
      stock: 0,
      is_active: true,
    });
    expect(payload).toHaveProperty('created_at');
  });

  it('prefers what the body supplied over the default', () => {
    const payload = buildProductCreatePayload({
      name: 'New', price: 100, category: 'kids', sizes: ['S', 'M'], stock: 7,
    });
    expect(payload.category).toBe('kids');
    expect(payload.sizes).toEqual(['S', 'M']);
    expect(payload.stock).toBe(7);
  });
});

describe('normalisation, shared by both', () => {
  it('caps name and description rather than letting the database refuse them', () => {
    const payload = buildProductUpdatePayload({ name: 'n'.repeat(500), description: 'd'.repeat(2000) });
    expect((payload.name as string).length).toBe(100);
    expect((payload.description as string).length).toBe(500);
  });

  it('refuses a nonsensical price instead of writing NaN', () => {
    // Number(undefined) is NaN, which Postgres rejects and which would have
    // failed the whole save with an opaque error.
    for (const price of ['abc', null, -5, {}]) {
      expect(buildProductUpdatePayload({ price }).price).toBe(0);
    }
    expect(buildProductUpdatePayload({ price: '5500' }).price).toBe(5500);
  });

  it('refuses negative or fractional stock', () => {
    expect(buildProductUpdatePayload({ stock: -3 }).stock).toBe(0);
    expect(buildProductUpdatePayload({ stock: 4.7 }).stock).toBe(4);
    expect(buildProductUpdatePayload({ stock: 'nope' }).stock).toBe(0);
  });

  it('accepts only the two sizing types', () => {
    expect(buildProductUpdatePayload({ sizing_type: 'age' }).sizing_type).toBe('age');
    expect(buildProductUpdatePayload({ sizing_type: 'size' }).sizing_type).toBe('size');
    expect(buildProductUpdatePayload({ sizing_type: 'nonsense' }).sizing_type).toBe('size');
  });

  it('coerces a non-array to an empty array rather than storing a string', () => {
    expect(buildProductUpdatePayload({ sizes: 'S' }).sizes).toEqual([]);
    expect(buildProductUpdatePayload({ colors: null }).colors).toEqual([]);
  });

  it('stringifies array members, so a stray number cannot break the column', () => {
    expect(buildProductUpdatePayload({ sizes: [1, 'M'] }).sizes).toEqual(['1', 'M']);
  });
});

describe('fit and sizing', () => {
  it('accepts the third sizing type, which picks the maternity size chart', () => {
    expect(buildProductUpdatePayload({ sizing_type: 'maternity' }).sizing_type).toBe('maternity');
  });

  it('stores an unrecorded fit as NULL, not as a claim', () => {
    // The admin form's "Not recorded" option submits ''. Storing that as
    // 'true_to_size' would put a fit claim on the product page that nobody made.
    expect(buildProductUpdatePayload({ fit_rating: '' }).fit_rating).toBeNull();
    expect(buildProductUpdatePayload({ fit_rating: 'nonsense' }).fit_rating).toBeNull();
    expect(buildProductCreatePayload({ name: 'x', price: 1 }).fit_rating).toBeNull();
  });

  it('keeps the three ratings the column allows', () => {
    for (const rating of ['runs_small', 'true_to_size', 'runs_large']) {
      expect(buildProductUpdatePayload({ fit_rating: rating }).fit_rating).toBe(rating);
    }
  });

  it('trims a fit note, caps it, and stores an empty one as NULL', () => {
    expect(buildProductUpdatePayload({ fit_note: '  snug neck  ' }).fit_note).toBe('snug neck');
    expect(buildProductUpdatePayload({ fit_note: '   ' }).fit_note).toBeNull();
    expect(String(buildProductUpdatePayload({ fit_note: 'x'.repeat(400) }).fit_note)).toHaveLength(300);
  });

  it('leaves fit alone when the body does not mention it', () => {
    // The rule this whole module exists for: an omitted field keeps its value.
    expect(buildProductUpdatePayload({ name: 'Bib' })).not.toHaveProperty('fit_rating');
    expect(buildProductUpdatePayload({ name: 'Bib' })).not.toHaveProperty('fit_note');
  });
});
