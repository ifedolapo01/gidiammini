/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// app/products/page.tsx - UPDATED FOR DYNAMIC URL CATEGORY FILTER
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ProductCard from '@/components/commerce/ProductCard';
import { Filter } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ProductCardProduct } from '@/types/product';
import { Button, Skeleton, Spinner } from '@/components/ui';

function ProductsListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryParam = searchParams?.get('category') || 'all';
  const subCategoryParam = searchParams?.get('subcategory') || 'all';

  const [products, setProducts] = useState<ProductCardProduct[]>([]);
  const [categories, setCategories] = useState<{name: string, slug: string, subcategories?: {name: string, slug: string}[]}[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryParam);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>(subCategoryParam);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOutOfStock, setShowOutOfStock] = useState(false);

  // Sync state if URL query param changes
  useEffect(() => {
    setSelectedCategory(categoryParam);
    setSelectedSubCategory(subCategoryParam);
  }, [categoryParam, subCategoryParam]);

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
          <div className="sticky top-24 bg-surface p-6 rounded-surface shadow-elevation-1 border border-primary/10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-body-lg font-semibold flex items-center text-text-primary">
                <Filter className="w-5 h-5 mr-2 text-primary" />
                Filters
              </h3>
              <button
                onClick={() => setShowFilters(false)}
                className="md:hidden text-text-secondary"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="font-medium mb-3 text-text-primary">Category</h4>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setSelectedCategory('all');
                      setSelectedSubCategory('all');
                    }}
                    className={`block w-full text-left px-3 py-2 rounded-control transition-colors ${
                      selectedCategory === 'all'
                        ? 'bg-primary/10 text-primary border border-primary/20 font-semibold'
                        : 'hover:bg-surface-hover text-text-primary font-medium'
                    }`}
                  >
                    All Products
                  </button>
                  {categories.map(category => (
                    <div key={category.slug} className="space-y-1">
                      <button
                        onClick={() => {
                          router.push(`/products?category=${category.slug}&subcategory=all`, { scroll: false });
                        }}
                        className={`block w-full text-left px-3 py-2 rounded-control transition-colors ${
                          selectedCategory === category.slug
                            ? 'bg-primary/10 text-primary border border-primary/20 font-semibold'
                            : 'hover:bg-surface-hover text-text-primary font-medium'
                        }`}
                      >
                        {category.name}
                      </button>

                      {/* Subcategories (only show if parent category is selected) */}
                      {selectedCategory === category.slug && category.subcategories && category.subcategories.length > 0 && (
                        <div className="pl-4 pr-2 py-1 space-y-1 border-l-2 border-primary/10 ml-2 mb-2">
                          <button
                            onClick={() => {
                              router.push(`/products?category=${category.slug}&subcategory=all`, { scroll: false });
                            }}
                            className={`block w-full text-left px-3 py-1.5 rounded-control text-body-sm transition-colors ${
                              selectedSubCategory === 'all'
                                ? 'text-primary font-semibold bg-primary/10'
                                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                            }`}
                          >
                            All {category.name}
                          </button>
                          {category.subcategories.map(sub => (
                            <button
                              key={sub.slug}
                              onClick={() => {
                                router.push(`/products?category=${category.slug}&subcategory=${sub.slug}`, { scroll: false });
                              }}
                              className={`block w-full text-left px-3 py-1.5 rounded-control text-body-sm transition-colors ${
                                selectedSubCategory === sub.slug
                                  ? 'text-primary font-semibold bg-primary/10'
                                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
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
              <h1 className="text-h3 font-extrabold text-text-primary tracking-tight">Our Collection</h1>
              <p className="text-text-secondary mt-1">
                {loading ? 'Loading...' : `${products.length} products found`}
              </p>
            </div>
            <Button
              variant="outline"
              size="md"
              onClick={() => setShowFilters(true)}
              className="md:hidden"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-96" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16 bg-surface rounded-surface border border-primary/10 p-8 shadow-elevation-1">
              <p className="text-text-secondary text-body-lg font-medium">No products found in this category.</p>
              <p className="text-text-muted text-body-sm mt-2">
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
        <Spinner size="xl" className="text-primary mx-auto mb-4" />
        <p className="text-text-secondary">Loading collection...</p>
      </div>
    }>
      <ProductsListContent />
    </Suspense>
  );
}
