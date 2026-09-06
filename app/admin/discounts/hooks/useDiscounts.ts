/** ADMIN layer — the discount form and modal, and the writes behind them.
 * The reads live in useDiscountData.ts. */
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui';
import { useDiscountStatus } from './useDiscountStatus';
import { Discount } from '@/lib/commerce/discounts';
import { emptyFormData, type DiscountFormData } from './useDiscounts.types';

export type { DiscountFormData };
import { useDiscountData } from './useDiscountData';

export function useDiscounts() {
  const confirm = useConfirm();
  const { discounts, categories, products, loading, error, setError, refresh } = useDiscountData();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Activating and pausing is its own hook: the write and the undo that
  // reverses it belong together and to nothing else here.
  const { toggleStatus } = useDiscountStatus({ refresh, setPendingId });

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
          end_date: '',
          // Deliberately not copied: a code is unique, so reusing a discount
          // that has one has to mint a new code rather than collide with the
          // original. Limits are left blank for the same reason — a reused
          // campaign is a new campaign, and inheriting "47 of 50 used" would
          // make it expire on its third order.
          code: '',
          max_redemptions: '',
          per_customer_limit: '',
          min_order_value: discount.min_order_value ? String(discount.min_order_value) : '',
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
          code: discount.code ?? '',
          max_redemptions: discount.max_redemptions ? String(discount.max_redemptions) : '',
          per_customer_limit: discount.per_customer_limit ? String(discount.per_customer_limit) : '',
          min_order_value: discount.min_order_value ? String(discount.min_order_value) : '',
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
    const discount = discounts.find((candidate) => candidate.id === id);
    const isLive = discount?.is_active;

    const confirmed = await confirm({
      title: discount ? `Delete ${discount.name}?` : 'Delete this discount?',
      message: isLive
        ? 'This discount is live. Deleting it stops it applying to new carts immediately.'
        : undefined,
      consequences: [
        discount?.code
          ? `The code ${discount.code} stops working at checkout`
          : 'It stops applying to any product it currently prices',
        'Orders already placed with it keep the price they were given',
        'Cannot be undone — deactivating instead keeps the record',
      ],
      confirmLabel: 'Delete discount',
    });
    if (!confirmed) return;

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

  return {
    discounts, categories, products,
    loading, error,
    isModalOpen, editingId, isSubmitting, pendingId,
    formData, setFormData,
    openModal, closeModal,
    handleSubmit, handleDelete, toggleStatus,
  };
}
