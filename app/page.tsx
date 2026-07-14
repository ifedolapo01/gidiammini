/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// app/page.tsx - KEEP AS SERVER COMPONENT
import ProductCard from '@/components/commerce/ProductCard';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ProductCardProduct } from '@/types/product';
import HeroCarousel from '@/components/HeroCarousel';

export default async function HomePage() {
  const supabase = await createClient();
  
  // Fetch featured products from Supabase
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) {
    console.error('Error fetching products:', error);
  }

  const featuredProducts = (products as ProductCardProduct[])?.slice(0, 4) || [];

  // Fetch dynamic categories
  const { data: categoriesData } = await supabase
    .from('categories')
    .select('*, subcategories(*)')
    .order('created_at', { ascending: true });

  const categories = categoriesData || [];

  // Fetch active discounts
  const { data: discountsData } = await supabase
    .from('discounts')
    .select('*')
    .eq('is_active', true);

  const discounts = discountsData || [];

  return (
    <div className="bg-primary/5">
      {/* Hero Carousel Section */}
      <HeroCarousel />

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
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
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
              {featuredProducts.map(product => (
                <ProductCard key={product.id} product={product} discounts={discounts} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Categories */}
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
            {categories?.map((cat) => (
              <Link 
                key={cat.id}
                href={`/products?category=${cat.slug}`}
                className="relative group overflow-hidden rounded-surface shadow-elevation-2 hover:shadow-elevation-4 transition-all hover:-translate-y-1"
              >
                <div className={`h-56 md:h-72 bg-gradient-to-br ${cat.color || 'from-secondary/80 to-accent/90'} flex flex-col justify-end p-6 md:p-8 text-text-inverse`}>
                  <h3 className="text-h4 md:text-h3 font-extrabold mb-1">{cat.name}</h3>
                  <p className="text-text-inverse/90 text-body-sm font-medium line-clamp-2">
                    {cat.subcategories && cat.subcategories.length > 0 
                      ? cat.subcategories.map((s: any) => s.name).join(' • ')
                      : `Shop our ${cat.name.toLowerCase()} collection`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}