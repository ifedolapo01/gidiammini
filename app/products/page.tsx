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
  const [categories, setCategories] = useState<{name: string, slug: string, subcategories?: {name: string, slug: string}[]}[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryParam);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOutOfStock, setShowOutOfStock] = useState(false);

  // Sync state if URL query param changes
  useEffect(() => {
    setSelectedCategory(categoryParam);
    setSelectedSubCategory('all');
  }, [categoryParam]);

  useEffect(() => {
    loadData();
  }, [selectedCategory, selectedSubCategory]);

  const loadData = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      
      // Fetch products
      let query = supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }

      if (selectedSubCategory !== 'all') {
        query = query.eq('sub_category', selectedSubCategory);
      }

      const isAdmin = false; // Replace with actual auth check
      if (!isAdmin && !showOutOfStock) {
        query = query.gt('stock', 0);
      }

      // Fetch Categories with subcategories
      const categoriesPromise = supabase
        .from('categories')
        .select('name, slug, subcategories(name, slug)')
        .order('name');
        
      // Fetch Discounts
      const discountsPromise = supabase
        .from('discounts')
        .select('*')
        .eq('is_active', true);

      const [productsRes, categoriesRes, discountsRes] = await Promise.all([
        query,
        categoriesPromise,
        discountsPromise
      ]);

      if (!productsRes.error) {
        setProducts(productsRes.data as ProductCardProduct[] || []);
      }
      
      if (!categoriesRes.error) {
        setCategories(categoriesRes.data || []);
      }
      
      if (!discountsRes.error) {
        setDiscounts(discountsRes.data || []);
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
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
                  <button
                    onClick={() => {
                      setSelectedCategory('all');
                      setSelectedSubCategory('all');
                    }}
                    className={`block w-full text-left px-3 py-2 rounded transition-colors ${
                      selectedCategory === 'all'
                        ? 'bg-pink-50 text-pink-600 border border-pink-200 font-semibold'
                        : 'hover:bg-gray-50 text-gray-700 font-medium'
                    }`}
                  >
                    All Products
                  </button>
                  {categories.map(category => (
                    <div key={category.slug} className="space-y-1">
                      <button
                        onClick={() => {
                          setSelectedCategory(category.slug);
                          setSelectedSubCategory('all');
                        }}
                        className={`block w-full text-left px-3 py-2 rounded transition-colors ${
                          selectedCategory === category.slug
                            ? 'bg-pink-50 text-pink-600 border border-pink-200 font-semibold'
                            : 'hover:bg-gray-50 text-gray-700 font-medium'
                        }`}
                      >
                        {category.name}
                      </button>
                      
                      {/* Subcategories (only show if parent category is selected) */}
                      {selectedCategory === category.slug && category.subcategories && category.subcategories.length > 0 && (
                        <div className="pl-4 pr-2 py-1 space-y-1 border-l-2 border-pink-100 ml-2 mb-2">
                          <button
                            onClick={() => setSelectedSubCategory('all')}
                            className={`block w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                              selectedSubCategory === 'all'
                                ? 'text-pink-600 font-semibold bg-pink-50/50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            All {category.name}
                          </button>
                          {category.subcategories.map(sub => (
                            <button
                              key={sub.slug}
                              onClick={() => setSelectedSubCategory(sub.slug)}
                              className={`block w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                                selectedSubCategory === sub.slug
                                  ? 'text-pink-600 font-semibold bg-pink-50/50'
                                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {sub.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
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
                <ProductCard key={product.id} product={product} discounts={discounts} />
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