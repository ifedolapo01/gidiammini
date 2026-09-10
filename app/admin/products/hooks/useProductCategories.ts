/** ADMIN layer — fetches admin category tree (with subcategories) for the product form. */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Category } from '@/types/product';
import { adminFetch } from '@/app/admin/lib/admin-fetch';

export function useProductCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const fetchCategories = useCallback(() => {
    return adminFetch('/api/admin/categories')
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

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { categories, loadingCategories, refetchCategories: fetchCategories };
}
