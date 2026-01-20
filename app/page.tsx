// app/page.tsx - KEEP AS SERVER COMPONENT
import ProductCard from '@/components/ProductCard';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ProductCardProduct } from '@/types/product';

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
    // Show a fallback state
  }

  const featuredProducts = (products as ProductCardProduct[])?.slice(0, 4) || [];

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="container mx-auto px-4 py-12 md:py-32">
          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 md:mb-6">
              Modern Streetwear for Everyday
            </h1>
            <p className="text-base sm:text-lg md:text-xl mb-6 md:mb-8 text-gray-300">
              Discover minimalist designs crafted for comfort and style. Quality clothing that fits your lifestyle.
            </p>
            <Link 
              href="/products" 
              className="inline-block bg-white text-gray-900 px-6 py-3 md:px-8 md:py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors text-sm md:text-base"
            >
              Shop Collection
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="py-8 md:py-16">
          <div className="container mx-auto px-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold mb-4 sm:mb-0">Featured Products</h2>
              <Link href="/products" className="text-blue-600 hover:text-blue-800 font-medium text-sm md:text-base">
                View All →
              </Link>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {featuredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="py-8 md:py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 text-black">Shop by Category</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Link 
              href="/products?category=men"
              className="relative group overflow-hidden rounded-xl md:rounded-2xl shadow-lg"
            >
              <div className="h-48 md:h-64 bg-gradient-to-r from-blue-900 to-blue-700 flex items-center justify-center">
                <div className="text-center px-4">
                  <h3 className="text-2xl md:text-4xl font-bold text-white mb-2">Men</h3>
                  <p className="text-blue-200 text-sm md:text-base">Minimalist essentials</p>
                </div>
              </div>
            </Link>
            
            <Link 
              href="/products?category=women"
              className="relative group overflow-hidden rounded-xl md:rounded-2xl shadow-lg"
            >
              <div className="h-48 md:h-64 bg-gradient-to-r from-purple-900 to-pink-700 flex items-center justify-center">
                <div className="text-center px-4">
                  <h3 className="text-2xl md:text-4xl font-bold text-white mb-2">Women</h3>
                  <p className="text-pink-200 text-sm md:text-base">Modern silhouettes</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}