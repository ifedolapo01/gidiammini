/** STOREFRONT layer — the 404 for an unknown, delisted or malformed product id. */
// A route-level not-found, so the response carries a real 404 status rather
// than the 200 the old inline "Product not found" panel returned. A 200 told
// crawlers a deleted product was still a valid page, which is how dead URLs
// stay in the index and keep absorbing crawl budget.
//
// This absorbed ProductPageStates.tsx, which paired this panel with a
// ProductLoadingState that no longer has a caller — see the note in page.tsx
// about why the route has no loading.tsx.
import Link from 'next/link';

export default function ProductNotFound() {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <h1 className="text-h4 font-bold text-text-primary mb-4">Product not found</h1>
      <Link
        href="/products"
        className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-control font-semibold hover:bg-primary-hover"
      >
        Continue Shopping
      </Link>
    </div>
  );
}
