/**
 * COMMERCE layer — a category slug rendered as the name shoppers read.
 *
 * Its own component, and the only client boundary this needs: ProductCard is
 * server-rendered from the homepage, the listing and the rails, and making the
 * whole card a client component to look up one label would move the entire
 * grid into the browser bundle.
 */
'use client';

import { useCategoryNav } from '@/components/CategoryProvider';

/** Falls back to the slug — `capitalize` at the call site makes it read. */
export default function CategoryLabel({ slug }: { slug: string }) {
  const { labelFor } = useCategoryNav();
  return <>{labelFor(slug)}</>;
}
