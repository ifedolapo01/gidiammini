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
                <ProductCard key={product.id} product={product} />
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
            {/* Babies */}
            <Link 
              href="/products?category=babies"
              className="relative group overflow-hidden rounded-2xl shadow-md hover:shadow-xl transition-all hover:-translate-y-1"
            >
              <div className="h-56 md:h-72 bg-gradient-to-br from-amber-300/80 to-orange-400/90 flex flex-col justify-end p-6 md:p-8 text-white">
                <span className="text-amber-100 text-xs font-bold uppercase tracking-widest mb-1">Ages 0 - 2</span>
                <h3 className="text-2xl md:text-3xl font-extrabold mb-1">Babies</h3>
                <p className="text-amber-50 text-sm font-medium">Soft organic basics & nursery sets</p>
              </div>
            </Link>
            
            {/* Kids */}
            <Link 
              href="/products?category=kids"
              className="relative group overflow-hidden rounded-2xl shadow-md hover:shadow-xl transition-all hover:-translate-y-1"
            >
              <div className="h-56 md:h-72 bg-gradient-to-br from-sky-300/80 to-indigo-400/90 flex flex-col justify-end p-6 md:p-8 text-white">
                <span className="text-sky-100 text-xs font-bold uppercase tracking-widest mb-1">Ages 2 - 12</span>
                <h3 className="text-2xl md:text-3xl font-extrabold mb-1">Kids & Pre-Teens</h3>
                <p className="text-sky-50 text-sm font-medium">Playproof clothing & footwear</p>
              </div>
            </Link>

            {/* Maternity */}
            <Link 
              href="/products?category=maternity"
              className="relative group overflow-hidden rounded-2xl shadow-md hover:shadow-xl transition-all hover:-translate-y-1"
            >
              <div className="h-56 md:h-72 bg-gradient-to-br from-pink-300/80 to-purple-400/90 flex flex-col justify-end p-6 md:p-8 text-white">
                <span className="text-pink-100 text-xs font-bold uppercase tracking-widest mb-1">For Mothers</span>
                <h3 className="text-2xl md:text-3xl font-extrabold mb-1">Maternity Wear</h3>
                <p className="text-pink-50 text-sm font-medium">Comfortable, elegant support styles</p>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}