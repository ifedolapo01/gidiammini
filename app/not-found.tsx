/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// The storefront 404.
//
// Reached two ways: a URL that matches no route at all, and any route calling
// notFound() without a closer boundary — which today means a delisted product,
// since app/products/[id]/not-found.tsx handles the one that has its own.
//
// A dead end is the failure mode worth avoiding here. Someone arriving on a
// broken link from WhatsApp has no history to go back to, so this offers the
// three things that actually recover the visit: search, the real categories,
// and the full collection.
import Link from 'next/link';
import { Search } from 'lucide-react';
import { loadCategoryNav } from '@/lib/commerce/category-nav';

export default async function NotFound() {
  const categories = await loadCategoryNav();

  return (
    <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg text-center">
        <p className="mb-2 text-h4 font-black tracking-tight text-primary sm:text-h3">404</p>
        <h1 className="mb-3 text-h5 font-bold text-text-primary sm:text-h4">
          We could not find that page
        </h1>
        <p className="mb-8 text-body-sm text-text-secondary sm:text-body-md">
          The link may be out of date, or the product may have sold out and been
          taken down. Here is where to look instead.
        </p>

        <div className="mb-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/products"
            className="inline-flex h-11 w-full items-center justify-center rounded-control bg-primary px-6 text-body-md font-semibold text-primary-foreground transition-colors hover:bg-primary-hover sm:w-auto"
          >
            Browse the collection
          </Link>
          <Link
            href="/search"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-control border border-border-strong px-6 text-body-md font-semibold text-text-primary transition-colors hover:bg-surface-hover sm:w-auto"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Search for something
          </Link>
        </div>

        {categories.length > 0 && (
          <div className="border-t border-border pt-8">
            <h2 className="mb-4 text-caption-md font-semibold uppercase tracking-wide text-text-muted">
              Shop by category
            </h2>
            <ul className="flex flex-wrap items-center justify-center gap-2">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/products?category=${encodeURIComponent(category.slug)}`}
                    className="inline-flex h-11 items-center rounded-full bg-primary/10 px-5 text-body-sm font-semibold text-primary transition-colors hover:bg-primary/20"
                  >
                    {category.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
