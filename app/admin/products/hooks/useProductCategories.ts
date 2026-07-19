/** ADMIN layer — fetches admin category tree (with subcategories) for the product form. */
'use client';

import { useEffect, useState } from 'react';
import { Category } from '@/types/product';

export function useProductCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  useEffect(() => {
    fetch('/api/admin/categories')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setCategories(data.categories || []);
        setLoadingCategories(false);
      })
      .catch((err) => {
        console.error('Failed to fetch categories', err);
        setLoadingCategories(false);
      });
  }, []);

  return { categories, loadingCategories };
}
