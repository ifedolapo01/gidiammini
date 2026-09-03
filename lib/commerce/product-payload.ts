/**
 * COMMERCE layer — what a product save is allowed to write.
 *
 * This exists because of a data-loss bug. The admin PUT built its payload with
 * `images: body.images || []`, `stock: Number(body.stock) || 0` and so on for
 * every column, which means a request that omits a field does not leave it
 * alone — it *clears* it. The admin form always submits every field, so it
 * never showed there; a partial update from anywhere else silently wiped
 * sizes, colours, category, stock and the main image.
 *
 * So create and update are now different operations rather than the same
 * builder:
 *
 *   - create fills in defaults, because a new row genuinely has no value yet.
 *   - update includes only the keys actually present in the body, so anything
 *     unmentioned keeps whatever it had.
 */

/** The columns a product save may set, in either mode. */
const TEXT_MAX = { name: 100, description: 500, fit_note: 300 } as const;

type Payload = Record<string, unknown>;

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function asPrice(value: unknown): number {
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? price : 0;
}

function asStock(value: unknown): number {
  const stock = Number(value);
  return Number.isFinite(stock) && stock >= 0 ? Math.trunc(stock) : 0;
}

/** Every field a body may carry, with how to normalise it. */
const FIELDS: Record<string, (value: unknown) => unknown> = {
  name: (v) => String(v ?? '').substring(0, TEXT_MAX.name),
  description: (v) => String(v ?? '').substring(0, TEXT_MAX.description),
  price: asPrice,
  category: (v) => String(v ?? '') || 'babies',
  main_image: (v) => String(v ?? ''),
  images: asStringArray,
  colors: asStringArray,
  sizes: asStringArray,
  sizing_type: (v) => (v === 'age' || v === 'maternity' ? v : 'size'),
  // '' from the admin's "Not recorded" option becomes NULL: the column holds a
  // claim about the fit, and "no claim" is not the same as "true to size".
  fit_rating: (v) =>
    v === 'runs_small' || v === 'true_to_size' || v === 'runs_large' ? v : null,
  fit_note: (v) => {
    const note = String(v ?? '').trim().substring(0, TEXT_MAX.fit_note);
    return note === '' ? null : note;
  },
  details: asStringArray,
  sub_category: (v) => (v === null || v === undefined || v === '' ? null : String(v)),
  pricing_config: (v) => v ?? null,
  stock: asStock,
};

/** Defaults for a brand-new product, for fields the body did not supply. */
const CREATE_DEFAULTS: Payload = {
  description: '',
  category: 'babies',
  main_image: '',
  images: [],
  colors: [],
  sizes: [],
  sizing_type: 'size',
  details: [],
  fit_rating: null,
  fit_note: null,
  sub_category: null,
  pricing_config: null,
  stock: 0,
};

/**
 * A full row for INSERT. Absent fields take a default, which is correct here:
 * there is no previous value to preserve.
 */
export function buildProductCreatePayload(body: Record<string, unknown>): Payload {
  const now = new Date().toISOString();
  const payload: Payload = { ...CREATE_DEFAULTS, is_active: true, created_at: now, updated_at: now };

  for (const [field, normalise] of Object.entries(FIELDS)) {
    if (body[field] !== undefined) payload[field] = normalise(body[field]);
  }

  // name and price have no sensible default — a product without them is not a
  // product. The route validates their presence before calling this.
  payload.name = FIELDS.name(body.name);
  payload.price = FIELDS.price(body.price);

  return payload;
}

/**
 * Only what the body actually mentioned, so an omitted field keeps its value.
 *
 * `id` is excluded: it addresses the row, it is not a column to write.
 */
export function buildProductUpdatePayload(body: Record<string, unknown>): Payload {
  const payload: Payload = { updated_at: new Date().toISOString() };

  for (const [field, normalise] of Object.entries(FIELDS)) {
    if (body[field] !== undefined) payload[field] = normalise(body[field]);
  }

  return payload;
}
