/**
 * COMMERCE layer — validating an edit to a category.
 *
 * Pure, so the admin route's rules for "what may be changed on a category and
 * what counts as valid" are stated once and testable without a request. Only
 * these two fields are editable: `slug` is referenced by products and
 * discounts, and `name` is what the admin UI identifies rows by — changing
 * either is a migration, not a form.
 */

/** Matches the CHECK constraints on the columns. */
export const CATEGORY_LIMITS = {
  size_guidance: 2000,
  display_name: 100,
} as const;

export type CategoryEditField = keyof typeof CATEGORY_LIMITS;

/** The columns to write. A field the request didn't mention is absent here, so
 * the update leaves it alone; an empty one is null, meaning "not set". */
export type CategoryEdit = Partial<Record<CategoryEditField, string | null>>;

const LABELS: Record<CategoryEditField, string> = {
  size_guidance: 'Size guidance',
  display_name: 'Storefront name',
};

export type CategoryEditResult =
  | { ok: true; update: CategoryEdit }
  | { ok: false; error: string };

export function parseCategoryEdit(body: Record<string, unknown>): CategoryEditResult {
  const update: CategoryEdit = {};

  for (const field of Object.keys(CATEGORY_LIMITS) as CategoryEditField[]) {
    const value = body[field];
    if (value === undefined) continue;

    if (typeof value !== 'string') {
      return { ok: false, error: `${LABELS[field]} must be text` };
    }

    // Refused rather than truncated: silently dropping the end of somebody's
    // paragraph is worse than telling them.
    if (value.length > CATEGORY_LIMITS[field]) {
      return {
        ok: false,
        error: `${LABELS[field]} must be ${CATEGORY_LIMITS[field]} characters or fewer`,
      };
    }

    const trimmed = value.trim();
    // Empty means "not set", which is NULL. The storefront checks for a value,
    // and '' would render an empty panel or a blank nav link.
    update[field] = trimmed === '' ? null : trimmed;
  }

  if (Object.keys(update).length === 0) {
    return { ok: false, error: 'Nothing to update' };
  }

  return { ok: true, update };
}
