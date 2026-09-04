/**
 * COMMERCE layer — the shape of the storefront's category navigation.
 *
 * Client-safe half of category-nav.ts: that module reads the table and is
 * `server-only`, this one holds the type and the pure label/link logic, so the
 * header, the footer and the product cards can all agree on what a category is
 * called without any of them importing a database client.
 *
 * The header and footer used to hardcode Babies / Kids / Maternity — twice in
 * the header alone — and the product card carried its own 'kids' special case,
 * which is why adding a category in the admin changed nothing on the site.
 */

export interface CategoryNavItem {
  /** The admin-facing name; UNIQUE in the table. */
  name: string;
  /** What products and discounts reference, and the ?category= value. */
  slug: string;
  /** What a shopper reads: `display_name` when set, otherwise `name`. */
  label: string;
}

/** The storefront's label for a category row. NULL display_name means "use name". */
export function categoryLabel(category: {
  name: string;
  display_name?: string | null;
}): string {
  return category.display_name?.trim() || category.name;
}

/**
 * The label for one slug. Falls back to the slug itself, which is what a card
 * rendered before its category list arrived — or for a product whose category
 * row has since been deleted — should show; `capitalize` in the markup makes
 * "babies" read as "Babies".
 */
export function findCategoryLabel(categories: CategoryNavItem[], slug: string): string {
  const match = categories.find(
    (category) => category.slug.toLowerCase() === slug.trim().toLowerCase()
  );
  return match?.label ?? slug;
}

export interface StorefrontNavLink {
  href: string;
  label: string;
  /** The ?category= value this link selects, for the active-state check.
   * Absent on the links that select no category. */
  category?: string;
}

/**
 * The storefront's top-level links: the two fixed entries, then one per
 * category in the order the table returned them. Built once and rendered by
 * both the desktop nav and the mobile menu, so the two can no longer drift.
 */
export function buildStorefrontNavLinks(categories: CategoryNavItem[]): StorefrontNavLink[] {
  return [
    { href: '/', label: 'Home' },
    { href: '/products', label: 'All Products' },
    ...categories.map((category) => ({
      href: `/products?category=${encodeURIComponent(category.slug)}`,
      label: category.label,
      category: category.slug,
    })),
  ];
}
