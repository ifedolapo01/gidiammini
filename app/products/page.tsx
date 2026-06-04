// app/products/page.tsx - UPDATED FOR DYNAMIC URL CATEGORY FILTER
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ProductCard from '@/components/ProductCard';
import { Filter } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ProductCardProduct } from '@/types/product';

function ProductsListContent() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams?.get('category') || 'all';

  const [products, setProducts] = useState<ProductCardProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryParam);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOutOfStock, setShowOutOfStock] = useState(false);

  // Sync state if URL query param changes
  useEffect(() => {
    setSelectedCategory(categoryParam);
  }, [categoryParam]);

  useEffect(() => {
    loadProducts();
  }, [selectedCategory]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      
      let query = supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }

      const isAdmin = false; // Replace with actual auth check
      if (!isAdmin && !showOutOfStock) {
        query = query.gt('stock', 0);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading products:', error);
        setProducts([]);
      } else {
        setProducts(data as ProductCardProduct[] || []);
      }
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Filters Sidebar */}
        <aside className={`md:w-64 ${showFilters ? 'block' : 'hidden md:block'}`}>
          <div className="sticky top-24 bg-white p-6 rounded-lg shadow-sm border border-pink-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold flex items-center text-gray-900">
                <Filter className="w-5 h-5 mr-2 text-pink-500" />
                Filters
              </h3>
              <button 
                onClick={() => setShowFilters(false)}
                className="md:hidden text-gray-500"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-medium mb-3 text-gray-700">Category</h4>
                <div className="space-y-2">
                  {['all', 'babies', 'kids', 'maternity'].map(category => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`block w-full text-left px-3 py-2 rounded capitalize transition-colors ${
                        selectedCategory === category
                          ? 'bg-pink-50 text-pink-600 border border-pink-200 font-semibold'
                          : 'hover:bg-gray-50 text-gray-700 font-medium'
                      }`}
                    >
                      {category === 'all' ? 'All Products' : category === 'kids' ? 'Kids & Pre-Teens' : category}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Products Grid */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Our Collection</h1>
              <p className="text-gray-600 mt-1">
                {loading ? 'Loading...' : `${products.length} products found`}
              </p>
            </div>
            <button 
              onClick={() => setShowFilters(true)}
              className="md:hidden flex items-center px-4 py-2 border border-pink-200 rounded-lg text-pink-600 font-medium bg-white"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </button>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-gray-200 rounded-lg h-96 animate-pulse"></div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-pink-100/50 p-8 shadow-sm">
              <p className="text-gray-500 text-lg font-medium">No products found in this category.</p>
              <p className="text-gray-400 text-sm mt-2">
                Check back soon or browse other collections!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500 mx-auto mb-4"></div>
        <p className="text-gray-500">Loading collection...</p>
      </div>
    }>
      <ProductsListContent />
    </Suspense>
  );
}