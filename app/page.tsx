// app/page.tsx - KEEP AS SERVER COMPONENT
import ProductCard from '@/components/ProductCard';
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
    <div className="bg-pink-50/20">
      {/* Hero Carousel Section */}
      <HeroCarousel />

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="py-12 md:py-20">
          <div className="container mx-auto px-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-10">
              <div>
                <h2 className="text-2xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
                  Featured Arrivals
                </h2>
                <p className="text-gray-500 mt-1 text-sm md:text-base">
                  Specially handpicked clothing and accessories for your family
                </p>
              </div>
              <Link 
                href="/products" 
                className="mt-4 sm:mt-0 px-6 py-2.5 rounded-full bg-pink-100 text-pink-700 hover:bg-pink-200 font-bold transition-all text-sm md:text-base text-center inline-block"
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
      <section className="py-12 md:py-20 bg-white border-t border-b border-pink-100/50">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="text-2xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
              Shop by Category
            </h2>
            <p className="text-gray-500 mt-2 text-sm md:text-base">
              Find exactly what you need for every milestone of the journey.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {categories?.map((cat) => (
              <Link 
                key={cat.id}
                href={`/products?category=${cat.slug}`}
                className="relative group overflow-hidden rounded-2xl shadow-md hover:shadow-xl transition-all hover:-translate-y-1"
              >
                <div className={`h-56 md:h-72 bg-gradient-to-br ${cat.color || 'from-sky-300/80 to-indigo-400/90'} flex flex-col justify-end p-6 md:p-8 text-white`}>
                  <h3 className="text-2xl md:text-3xl font-extrabold mb-1">{cat.name}</h3>
                  <p className="text-white/90 text-sm font-medium line-clamp-2">
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