/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// app/products/page.tsx - UPDATED FOR DYNAMIC URL CATEGORY FILTER
'use client';

import { useState, Suspense } from 'react';
import ProductCard from '@/components/commerce/ProductCard';
import { Filter } from 'lucide-react';
import { Button, Skeleton, Spinner } from '@/components/ui';
import { useProductsListing } from './hooks/useProductsListing';
import CategoryFilterSidebar from './components/CategoryFilterSidebar';

function ProductsListContent() {
  const [showFilters, setShowFilters] = useState(false);
  const {
    products,
    categories,
    discounts,
    loading,
    selectedCategory,
    selectedSubCategory,
    clearFilters,
    navigateToCategory,
  } = useProductsListing();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        <CategoryFilterSidebar
          categories={categories}
          selectedCategory={selectedCategory}
          selectedSubCategory={selectedSubCategory}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          onSelectAll={clearFilters}
          onNavigate={navigateToCategory}
        />

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
