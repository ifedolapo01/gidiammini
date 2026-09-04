/** ADMIN layer hook — saves one editable field on a category. */
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { CategoryEditField } from '@/lib/commerce/category-edit';

interface UseCategoryPatchParams {
  field: CategoryEditField;
  /** Toast copy: what was saved, and what was cleared by an empty value. */
  labels: { saved: string; cleared: string };
  onSaved: () => void;
}

/**
 * Instantiated once per editable field, so each field keeps its own
 * per-row pending id — saving a category's storefront name must not put its
 * guidance button in a pending state, or vice versa.
 */
export function useCategoryPatch({ field, labels, onSaved }: UseCategoryPatchParams) {
  const [savingId, setSavingId] = useState<string | null>(null);

  const save = async (id: string, value: string) => {
    setSavingId(id);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: value }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(value.trim() ? labels.saved : labels.cleared);
        onSaved();
      } else {
        toast.error(data.error || `Failed to save ${labels.saved.toLowerCase()}`);
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setSavingId(null);
    }
  };

  return { savingId, save };
}
