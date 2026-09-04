/**
 * STOREFRONT layer — the category list, for components too deep to be handed it.
 *
 * The root layout reads the categories once per request and passes them
 * straight to the header and the footer, which are its own children. The
 * product card is not: it is rendered from the listing, the search results, the
 * recommendation rails, the wishlist and the cart, and threading a label
 * through every one of those to replace a one-line hardcode would be worse
 * than a context.
 *
 * Seeded from the server on every request, so there is no client fetch and no
 * empty first paint.
 */
'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { findCategoryLabel, type CategoryNavItem } from '@/lib/commerce/storefront-nav';

interface CategoryContextValue {
  categories: CategoryNavItem[];
  /** The storefront's label for a category slug; the slug itself if unknown. */
  labelFor: (slug: string) => string;
}

const CategoryContext = createContext<CategoryContextValue | undefined>(undefined);

export function CategoryProvider({
  categories,
  children,
}: {
  categories: CategoryNavItem[];
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({
      categories,
      labelFor: (slug: string) => findCategoryLabel(categories, slug),
    }),
    [categories]
  );

  return <CategoryContext.Provider value={value}>{children}</CategoryContext.Provider>;
}

/**
 * Unlike useCart, this does not throw without a provider: a product card is
 * rendered in enough places that one of them being outside the storefront
 * layout should degrade to the raw slug, not to a blank page.
 */
export function useCategoryNav(): CategoryContextValue {
  return (
    useContext(CategoryContext) ?? { categories: [], labelFor: (slug: string) => slug }
  );
}
