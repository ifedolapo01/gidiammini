/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// app/page.tsx - KEEP AS SERVER COMPONENT
//
// Presentation only. The two reads live in lib/commerce/home-query.ts, which
// caches them under the listing's `products` tag — this page previously
// queried through lib/supabase/server, and because that factory reads
// cookies() the whole page opted out of every cache Next has. The busiest
// route on the site went to the database three times per visitor.
//
// The three sections below no longer share a fate. Previously one component
// awaited three queries — products, then categories, then discounts, each
// waiting on the one before — and nothing at all was sent until the last of
// them came back. Each now streams in behind its own boundary as its data
// lands, hero included since it now reads homepage_slides — its skeleton
// reserves the same 520px so the page never lurches once it resolves.
//
// There is no loading.tsx for this route and there must not be: app/loading.tsx
// would wrap every route in the app, including /products/[id], whose
// notFound() then renders a 404 body under a 200 status. The boundaries live
// here instead, where they cover only what they should.
import { Suspense } from 'react';
import Link from 'next/link';
import ProductCard from '@/components/commerce/ProductCard';
import { ProductGridSkeleton } from '@/components/commerce/ProductCardSkeleton';
import { Skeleton } from '@/components/ui';
import HeroCarousel from '@/components/HeroCarousel';
import { loadFeaturedProducts, loadHomeCategories, loadHeroSlides } from '@/lib/commerce/home-query';

const FEATURED_GRID = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8';

export default function HomePage() {
  return (
    <div className="bg-primary/5">
      <Suspense fallback={<HeroSkeleton />}>
        <Hero />
      </Suspense>

      <Suspense fallback={<FeaturedProductsSkeleton />}>
        <FeaturedProducts />
      </Suspense>

      <Suspense fallback={<CategoriesSkeleton />}>
        <Categories />
      </Suspense>
    </div>
  );
}

async function Hero() {
  const slides = await loadHeroSlides();
  return <HeroCarousel slides={slides} />;
}

async function FeaturedProducts() {
  const { products: featuredProducts, discounts } = await loadFeaturedProducts();

  if (featuredProducts.length === 0) return null;

  return (
    <section className="py-12 md:py-20">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-10">
          <div>
            <h2 className="text-h4 md:text-h2 font-extrabold text-text-primary tracking-tight">
              Featured Arrivals
            </h2>
            <p className="text-text-secondary mt-1 text-body-sm md:text-body-md">
              Specially handpicked clothing and accessories for your family
            </p>
          </div>
          <Link
            href="/products"
            className="mt-4 sm:mt-0 px-6 py-2.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 font-bold transition-all text-body-sm md:text-body-md text-center inline-block"
          >
            View All Collection →
          </Link>
        </div>

        <div className={FEATURED_GRID}>
          {featuredProducts.map(product => (
            <ProductCard key={product.id} product={product} discounts={discounts} />
          ))}
        </div>
      </div>
    </section>
  );
}

async function Categories() {
  const categories = await loadHomeCategories();

  return (
    <section className="py-12 md:py-20 bg-surface border-t border-b border-primary/10">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-xl mx-auto mb-12">
          <h2 className="text-h4 md:text-h2 font-extrabold text-text-primary tracking-tight">
            Shop by Category
          </h2>
          <p className="text-text-secondary mt-2 text-body-sm md:text-body-md">
            Find exactly what you need for every milestone of the journey.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/products?category=${cat.slug}`}
              className="relative group overflow-hidden rounded-surface shadow-elevation-2 hover:shadow-elevation-4 transition-all hover:-translate-y-1"
            >
              <div className={`h-56 md:h-72 bg-gradient-to-br ${cat.color || 'from-secondary/80 to-accent/90'} flex flex-col justify-end p-6 md:p-8 text-text-inverse`}>
                <h3 className="text-h4 md:text-h3 font-extrabold mb-1">{cat.name}</h3>
                <p className="text-text-inverse/90 text-body-sm font-medium line-clamp-2">
                  {cat.subcategories.length > 0
                    ? cat.subcategories.map((sub) => sub.name).join(' • ')
                    : `Shop our ${cat.name.toLowerCase()} collection`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* The fallbacks below reserve the same height as the sections they stand in
   for, so the page does not lurch as each one resolves. */

function HeroSkeleton() {
  return <Skeleton className="h-[520px] w-full rounded-none" />;
}

function FeaturedProductsSkeleton() {
  return (
    <section className="py-12 md:py-20">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-10">
          <div>
            <Skeleton className="h-8 w-56 md:h-10" />
            <Skeleton className="mt-2 h-5 w-72" />
          </div>
          <Skeleton className="mt-4 h-11 w-48 rounded-full sm:mt-0" />
        </div>
        <ProductGridSkeleton count={4} className={FEATURED_GRID} />
      </div>
    </section>
  );
}

function CategoriesSkeleton() {
  return (
    <section className="py-12 md:py-20 bg-surface border-t border-b border-primary/10">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-xl mx-auto mb-12">
          <Skeleton className="mx-auto h-8 w-56 md:h-10" />
          <Skeleton className="mx-auto mt-2 h-5 w-80" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto" aria-hidden="true">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-56 rounded-surface md:h-72" />
          ))}
        </div>
      </div>
    </section>
  );
}
