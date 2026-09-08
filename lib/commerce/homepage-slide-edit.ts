/**
 * COMMERCE layer — validating a write to a homepage_slides row.
 *
 * Pure, so the create and update routes share one definition of "what counts
 * as a valid slide" instead of two hand-rolled checks drifting apart. Create
 * requires the two fields nothing has a sane default for (image, title);
 * update accepts any subset, since the editor patches one field at a time.
 */

const LIMITS = {
  title: 200,
  subtitle: 500,
  cta_label: 60,
  cta_link: 500,
  image_path: 2000,
} as const;

type TextField = keyof typeof LIMITS;

export interface SlideFields {
  image_path?: string;
  title?: string;
  subtitle?: string;
  cta_label?: string;
  cta_link?: string;
  sort_order?: number;
  is_active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
}

export type SlideWriteResult =
  | { ok: true; update: SlideFields }
  | { ok: false; error: string };

/** Create's result narrows the two fields nothing has a sane default for down
 *  to required, so the insert below doesn't need a runtime-only guarantee
 *  restated as a cast. */
export type SlideCreateResult =
  | { ok: true; update: SlideFields & { image_path: string; title: string } }
  | { ok: false; error: string };

function readText(body: any, field: TextField): string | undefined | { error: string } {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return { error: `${field} must be text` };
  const trimmed = value.trim();
  if (trimmed.length > LIMITS[field]) {
    return { error: `${field} must be ${LIMITS[field]} characters or fewer` };
  }
  return trimmed;
}

function readTimestamp(body: any, field: 'starts_at' | 'ends_at'): string | null | undefined | { error: string } {
  const value = body[field];
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    return { error: `${field} must be a valid date` };
  }
  return new Date(value).toISOString();
}

/** Shared body across create and update — every field optional here, the
 *  caller decides what's required for its own operation. */
function parseFields(body: unknown): SlideWriteResult {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request body' };
  const source = body as Record<string, unknown>;
  const update: SlideFields = {};

  for (const field of Object.keys(LIMITS) as TextField[]) {
    const result = readText(source, field);
    if (result && typeof result === 'object' && 'error' in result) return { ok: false, error: result.error };
    if (result !== undefined) update[field] = result;
  }

  for (const field of ['starts_at', 'ends_at'] as const) {
    const result = readTimestamp(source, field);
    if (result && typeof result === 'object' && 'error' in result) return { ok: false, error: result.error };
    if (result !== undefined) update[field] = result;
  }

  if (source.sort_order !== undefined) {
    const rank = Number(source.sort_order);
    if (!Number.isFinite(rank)) return { ok: false, error: 'sort_order must be a number' };
    update.sort_order = Math.trunc(rank);
  }

  if (source.is_active !== undefined) {
    if (typeof source.is_active !== 'boolean') return { ok: false, error: 'is_active must be true or false' };
    update.is_active = source.is_active;
  }

  return { ok: true, update };
}

export function parseSlideCreate(body: unknown): SlideCreateResult {
  const parsed = parseFields(body);
  if (!parsed.ok) return parsed;

  const { image_path, title } = parsed.update;
  if (!image_path) return { ok: false, error: 'An image is required' };
  if (!title) return { ok: false, error: 'A title is required' };

  return {
    ok: true,
    update: {
      subtitle: '',
      cta_label: 'Shop Now',
      cta_link: '/products',
      is_active: true,
      ...parsed.update,
      image_path,
      title,
    },
  };
}

export function parseSlideUpdate(body: unknown): SlideWriteResult {
  const parsed = parseFields(body);
  if (!parsed.ok) return parsed;

  if (Object.keys(parsed.update).length === 0) return { ok: false, error: 'Nothing to update' };
  if (parsed.update.title === '') return { ok: false, error: 'Title cannot be empty' };
  if (parsed.update.image_path === '') return { ok: false, error: 'Image cannot be empty' };

  return parsed;
}
