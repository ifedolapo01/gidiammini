/** ADMIN layer — discount CRUD state: fetches discounts/categories/products and talks to /api/admin/discounts. */
'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Discount } from '@/lib/commerce/discounts';
import type { Category, Product } from '@/types/product';

export interface DiscountFormData {
  name: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: string;
  scope: 'SITEWIDE' | 'CATEGORY' | 'SUBCATEGORY' | 'PRODUCT' | 'VARIANT';
  target_id: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
}

const emptyFormData: DiscountFormData = {
  name: '',
  type: 'PERCENTAGE',
  value: '',
  scope: 'SITEWIDE',
  target_id: '',
  is_active: true,
  start_date: '',
  end_date: '',
};

export function useDiscounts() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<DiscountFormData>(emptyFormData);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch discounts
      const discRes = await fetch('/api/admin/discounts');
      const discData = await discRes.json();
      if (discData.success) setDiscounts(discData.discounts);

      // Fetch categories for the target dropdown
      const catRes = await fetch('/api/admin/categories');
      const catData = await catRes.json();
      if (catData.success) setCategories(catData.categories);

      // Fetch products for the target dropdown
      const prodRes = await fetch('/api/admin/products');
      const prodData = await prodRes.json();
      if (prodData.success) setProducts(prodData.products);

    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (discount?: Discount, isReuse: boolean = false) => {
    if (discount) {
      if (isReuse) {
        setEditingId(null);
        setFormData({
          name: discount.name,
          type: discount.type,
          value: discount.value.toString(),
          scope: discount.scope,
          target_id: discount.target_id || '',
          is_active: true,
          start_date: '',
          end_date: ''
        });
      } else {
        setEditingId(discount.id);
        setFormData({
          name: discount.name,
          type: discount.type,
          value: discount.value.toString(),
          scope: discount.scope,
          target_id: discount.target_id || '',
          is_active: discount.is_active,
          start_date: discount.start_date ? format(new Date(discount.start_date), "yyyy-MM-dd'T'HH:mm") : '',
          end_date: discount.end_date ? format(new Date(discount.end_date), "yyyy-MM-dd'T'HH:mm") : ''
        });
      }
    } else {
      setEditingId(null);
      setFormData(emptyFormData);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const url = '/api/admin/discounts';
      const method = editingId ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        id: editingId,
        value: Number(formData.value),
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        fetchData();
        closeModal();
      } else {
        setError(data.error || 'Failed to save discount');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this discount?')) return;

    try {
      const res = await fetch('/api/admin/discounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();

      if (data.success) {
        fetchData();
      } else {
        alert(data.error || 'Failed to delete discount');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const toggleStatus = async (discount: Discount) => {
    try {
      const res = await fetch('/api/admin/discounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...discount, is_active: !discount.is_active })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (err) {
      alert('Failed to toggle status');
    }
  };

  return {
    discounts, categories, products,
    loading, error,
    isModalOpen, editingId, isSubmitting,
    formData, setFormData,
    openModal, closeModal,
    handleSubmit, handleDelete, toggleStatus,
  };
}
