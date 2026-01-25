// app/products/page.tsx - UPDATED
'use client';

import { useState, useEffect } from 'react';
import ProductCard from '@/components/ProductCard';
import { Filter } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ProductCardProduct } from '@/types/product';

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductCardProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOutOfStock, setShowOutOfStock] = useState(false);

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
          <div className="sticky top-24 bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold flex items-center">
                <Filter className="w-5 h-5 mr-2" />
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
                <h4 className="font-medium mb-3">Category</h4>
                <div className="space-y-2">
                  {['all', 'men', 'women'].map(category => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`block w-full text-left px-3 py-2 rounded capitalize ${
                        selectedCategory === category
                          ? 'bg-blue-50 text-blue-600 border border-blue-200'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      {category === 'all' ? 'All Products' : `${category}'s Clothing`}
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
              <h1 className="text-3xl font-bold">Our Collection</h1>
              <p className="text-gray-600">
                {loading ? 'Loading...' : `${products.length} products found`}
              </p>
            </div>
            <button 
              onClick={() => setShowFilters(true)}
              className="md:hidden flex items-center px-4 py-2 border rounded-lg"
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
            <div className="text-center py-16">
              <p className="text-gray-500 text-lg">No products found.</p>
              <p className="text-gray-400 text-sm mt-2">
                Add products from the admin panel first.
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