/**
 * STOREFRONT layer — accumulating pages behind the "Load more" button.
 *
 * The first page arrives already rendered from the server component; this only
 * ever fetches the pages after it, and only when the shopper asks. That is the
 * whole difference from infinite scroll: nothing loads because you scrolled
 * past it, so the footer stays reachable and the shopper keeps the decision.
 *
 * The cursor is held here rather than in the URL. A link carrying "size 2" and
 * "resume from row 400" cannot be shared honestly — whoever opens it sees the
 * middle of someone else's browsing — so the URL stays the filter set and the
 * cursor stays a detail of this session.
 */
import { useCallback, useState } from 'react';
import type { ProductCardProduct } from '@/types/product';
import { productFiltersToQuery, type ProductFilters } from '@/lib/commerce/product-filters';

interface UseLoadMoreProductsArgs {
  filters: ProductFilters;
  initialProducts: ProductCardProduct[];
  initialCursor: string | null;
}

export function useLoadMoreProducts({
  filters,
  initialProducts,
  initialCursor,
}: UseLoadMoreProductsArgs) {
  const [products, setProducts] = useState<ProductCardProduct[]>(initialProducts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    // Guarding on `loading` as well as `cursor` because the button is the only
    // trigger and a double-press would otherwise append the same page twice.
    if (!cursor || loading) return;

    setLoading(true);
    setError(null);

    try {
      const query = productFiltersToQuery(filters);
      query.set('cursor', cursor);

      const response = await fetch(`/api/products?${query.toString()}`);
      const payload = await response.json();

      if (!payload.success) {
        setError(payload.error || 'We could not load more products.');
        return;
      }

      const incoming = (payload.products ?? []) as ProductCardProduct[];

      setProducts((current) => {
        // Belt and braces: a keyset page cannot repeat a row, but a stale
        // cursor from a re-render could, and a duplicate React key is a
        // rendering bug rather than a visible one.
        const seen = new Set(current.map((product) => product.id));
        return [...current, ...incoming.filter((product) => !seen.has(product.id))];
      });
      setCursor(payload.nextCursor ?? null);
    } catch (cause) {
      console.error('Load more failed:', cause);
      setError('We could not load more products. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [cursor, filters, loading]);

  return {
    products,
    loading,
    error,
    hasMore: cursor !== null,
    loadMore,
  };
}
