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
 * Formats "Category", "Category > Subcategory" or
 * "Category > Subcategory > Sub-subcategory" for display. Title-cases each
 * level, strips hyphens, and drops a level's prefix when it duplicates its
 * parent's name — the same de-duplication a subcategory slug like
 * `mens-clothing-gear` already needed one level up.
 */
export function formatCategoryStr(cat: string, sub: string | undefined | null, subSub?: string | undefined | null): string {
  const titleCase = (text: string) => text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const catTitle = titleCase(cat);
  if (!sub) return catTitle;

  const subTitle = titleCase(sub.replace(/-/g, ' '));
  let formattedSub = subTitle;
  if (subTitle.toLowerCase().startsWith(catTitle.toLowerCase())) {
    formattedSub = subTitle.substring(catTitle.length).trim();
  }

  const withSub = formattedSub ? `${catTitle} > ${formattedSub}` : catTitle;
  if (!subSub) return withSub;

  const subSubTitle = titleCase(subSub.replace(/-/g, ' '));
  let formattedSubSub = subSubTitle;
  if (subSubTitle.toLowerCase().startsWith(subTitle.toLowerCase())) {
    formattedSubSub = subSubTitle.substring(subTitle.length).trim();
  }

  return formattedSubSub ? `${withSub} > ${formattedSubSub}` : withSub;
}
