/**
 * CORE layer — turning a category/subcategory/sub-subcategory write's
 * constraint violation into a message an admin can act on.
 *
 * All three tables share the same two failure modes: the slug an admin (or
 * an import-time slugify()) generated already belongs to another row, or the
 * parent it names no longer exists. Left to throw, both land on
 * withAdminAuth's catch-all "Internal server error" — true, but useless to
 * whoever just typed a name that happened to collide.
 */
export interface CategoryWriteErrorContext {
  /** What this row is, for the message — "category", "subcategory", "sub-subcategory". */
  noun: string;
  /** What its parent is, so a broken foreign key can be named too. Omitted for categories, which have none. */
  parentNoun?: string;
}

export function describeCategoryWriteError(
  error: { code?: string; message?: string },
  { noun, parentNoun }: CategoryWriteErrorContext
): { message: string; status: number } {
  if (error.code === '23505') {
    return { message: `A ${noun} with that name or slug already exists.`, status: 409 };
  }
  if (error.code === '23503' && parentNoun) {
    return { message: `That ${parentNoun} no longer exists — refresh the page and try again.`, status: 409 };
  }
  return { message: error.message || `Failed to save the ${noun}.`, status: 500 };
}
