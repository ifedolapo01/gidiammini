/** STOREFRONT layer — GidiamMini branding. What we say instead of a dead end when a search matches nothing. */
import Link from 'next/link';
import { Search } from 'lucide-react';
import type { SearchFallback } from '@/lib/commerce/search-fallback';

interface SearchEmptyStateProps {
  query: string;
  fallback: SearchFallback;
}

export default function SearchEmptyState({ query, fallback }: SearchEmptyStateProps) {
  return (
    <div className="rounded-surface border border-primary/10 bg-surface p-8 py-16 text-center shadow-elevation-1">
      <p className="text-body-lg font-medium text-text-secondary">
        Nothing matches “{query}”.
      </p>

      {fallback.suggestions.length > 0 && (
        <div className="mt-6">
          <p className="text-body-sm text-text-muted">Did you mean:</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {fallback.suggestions.map((suggestion) => (
              <Link
                key={suggestion.id}
                href={`/products/${suggestion.id}`}
                className="inline-flex items-center px-3 py-1.5 rounded-control border border-border bg-surface text-body-sm text-text-secondary hover:border-primary hover:text-primary transition-colors"
              >
                {suggestion.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {fallback.categories.length > 0 && (
        <div className="mt-6">
          <p className="text-body-sm text-text-muted">Or browse:</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {fallback.categories.map((category) => (
              <Link
                key={category.slug}
                href={`/products?category=${category.slug}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-border bg-surface text-body-sm text-text-secondary hover:border-primary hover:text-primary transition-colors"
              >
                <Search className="w-3.5 h-3.5" aria-hidden="true" />
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link
        href="/products"
        className="inline-block mt-6 px-4 py-2 rounded-control bg-primary text-primary-foreground font-semibold text-body-sm hover:bg-primary-hover transition-colors"
      >
        Browse all products
      </Link>
    </div>
  );
}
