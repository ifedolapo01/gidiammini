/** STOREFRONT layer — products listing fetch + category/subcategory filter state. */
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ProductCardProduct } from '@/types/product';

interface CategoryWithSubcategories {
  name: string;
  slug: string;
  subcategories?: { name: string; slug: string }[];
}

export function useProductsListing() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryParam = searchParams?.get('category') || 'all';
  const subCategoryParam = searchParams?.get('subcategory') || 'all';

  const [products, setProducts] = useState<ProductCardProduct[]>([]);
  const [categories, setCategories] = useState<CategoryWithSubcategories[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryParam);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>(subCategoryParam);
  const [loading, setLoading] = useState(true);
  const [showOutOfStock] = useState(false);

  // Sync state if URL query param changes
  useEffect(() => {
    setSelectedCategory(categoryParam);
    setSelectedSubCategory(subCategoryParam);
  }, [categoryParam, subCategoryParam]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /** "All Products" — clears filters locally without updating the URL (matches original behavior). */
  const clearFilters = () => {
    setSelectedCategory('all');
    setSelectedSubCategory('all');
  };

  /** Category/subcategory buttons — navigates so the URL reflects the selection. */
  const navigateToCategory = (categorySlug: string, subCategorySlug: string = 'all') => {
    router.push(`/products?category=${categorySlug}&subcategory=${subCategorySlug}`, { scroll: false });
  };

  return {
    products,
    categories,
    discounts,
    loading,
    selectedCategory,
    selectedSubCategory,
    clearFilters,
    navigateToCategory,
  };
}
