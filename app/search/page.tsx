/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// app/search/page.tsx — the full results page behind the header typeahead.
'use client';

import { Suspense } from 'react';
import SearchResults from '@/components/search/SearchResults';

/**
 * Wrapped in Suspense because SearchResults reads the query from the URL with
 * useSearchParams, which Next requires a boundary around in a client page.
 */
export default function SearchPage() {
  return (
    <div className="min-h-screen bg-background-secondary">
      <div className="container mx-auto px-3 sm:px-4 py-6">
        <Suspense
          fallback={<p className="text-body-sm text-text-secondary">Loading search…</p>}
        >
          <SearchResults />
        </Suspense>
      </div>
    </div>
  );
}
