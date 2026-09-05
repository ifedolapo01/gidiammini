/** ADMIN layer — the discount form and modal, and the writes behind them.
 * The reads live in useDiscountData.ts. */
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Discount } from '@/lib/commerce/discounts';
import { useDiscountData } from './useDiscountData';

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
  const { discounts, categories, products, loading, error, setError, refresh } = useDiscountData();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<DiscountFormData>(emptyFormData);

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
        refresh();
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

    setPendingId(id);
    try {
      const res = await fetch('/api/admin/discounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();

      if (data.success) {
        refresh();
      } else {
        toast.error(data.error || 'Failed to delete discount');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setPendingId(null);
    }
  };

  const toggleStatus = async (discount: Discount) => {
    setPendingId(discount.id);
    try {
      const res = await fetch('/api/admin/discounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...discount, is_active: !discount.is_active })
      });
      const data = await res.json();
      if (data.success) {
        refresh();
      }
    } catch (err) {
      toast.error('Failed to toggle status');
    } finally {
      setPendingId(null);
    }
  };

  return {
    discounts, categories, products,
    loading, error,
    isModalOpen, editingId, isSubmitting, pendingId,
    formData, setFormData,
    openModal, closeModal,
    handleSubmit, handleDelete, toggleStatus,
  };
}
