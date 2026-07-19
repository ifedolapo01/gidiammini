/** COMMERCE layer — shared text formatting helpers. Used by Storefront and Admin. */

/** URL-safe slug: lowercase, non-alphanumeric runs collapsed to a single hyphen, no leading/trailing hyphens. */
export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

/** Title-cases each word (first letter up, rest lowercased). Returns '' for empty/nullish input. */
export function capitalizeText(text: string | undefined | null): string {
  if (!text) return '';
  return text.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

/**
 * Formats "Category" or "Category > Subcategory" for display. Title-cases both, strips hyphens from the
 * subcategory, and drops a subcategory prefix that duplicates the category name.
 */
export function formatCategoryStr(cat: string, sub: string | undefined | null): string {
  const catTitle = cat.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  if (!sub) return catTitle;
  const subClean = sub.replace(/-/g, ' ');
  const subTitle = subClean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  let formattedSub = subTitle;
  if (subTitle.toLowerCase().startsWith(catTitle.toLowerCase())) {
    formattedSub = subTitle.substring(catTitle.length).trim();
  }
  return formattedSub ? `${catTitle} > ${formattedSub}` : catTitle;
}
