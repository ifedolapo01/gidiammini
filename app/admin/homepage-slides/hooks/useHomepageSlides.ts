/** ADMIN layer hook — homepage_slides data + CRUD for the Homepage editor page. */
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui';
import { adminFetch } from '@/app/admin/lib/admin-fetch';

export interface HomepageSlide {
  id: string;
  image_path: string;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_link: string;
  sort_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

export type SlideDraft = Omit<HomepageSlide, 'id' | 'sort_order'>;

export function useHomepageSlides() {
  const confirm = useConfirm();
  const [slides, setSlides] = useState<HomepageSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingSlide, setEditingSlide] = useState<HomepageSlide | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const fetchSlides = async () => {
    try {
      setLoading(true);
      const response = await adminFetch('/api/admin/homepage-slides');
      const data = await response.json();
      if (data.success) setSlides(data.slides ?? []);
      else setError(data.error || 'Failed to load homepage slides');
    } catch {
      setError('Network error loading homepage slides');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlides();
  }, []);

  const openCreateModal = () => {
    setEditingSlide(null);
    setIsModalOpen(true);
  };

  const openEditModal = (slide: HomepageSlide) => {
    setEditingSlide(slide);
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const saveSlide = async (draft: SlideDraft) => {
    setIsSaving(true);
    try {
      const response = await adminFetch(
        editingSlide ? `/api/admin/homepage-slides/${editingSlide.id}` : '/api/admin/homepage-slides',
        {
          method: editingSlide ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        }
      );
      const data = await response.json();

      if (!data.success) {
        toast.error(data.error || 'Failed to save slide');
        return;
      }

      toast.success(editingSlide ? 'Slide updated' : 'Slide added');
      setIsModalOpen(false);
      fetchSlides();
    } catch {
      toast.error('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (slide: HomepageSlide) => {
    const response = await adminFetch(`/api/admin/homepage-slides/${slide.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !slide.is_active }),
    });
    const data = await response.json();
    if (data.success) fetchSlides();
    else toast.error(data.error || 'Failed to update slide');
  };

  /** Swaps this slide's position with its neighbour in `direction` — good
   *  enough for a handful of hero slides, without a drag-and-drop library. */
  const move = async (slide: HomepageSlide, direction: 'up' | 'down') => {
    const ordered = [...slides].sort((a, b) => a.sort_order - b.sort_order);
    const index = ordered.findIndex((row) => row.id === slide.id);
    const swapWith = direction === 'up' ? ordered[index - 1] : ordered[index + 1];
    if (!swapWith) return;

    await Promise.all([
      adminFetch(`/api/admin/homepage-slides/${slide.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: swapWith.sort_order }),
      }),
      adminFetch(`/api/admin/homepage-slides/${swapWith.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: slide.sort_order }),
      }),
    ]);
    fetchSlides();
  };

  const deleteSlide = async (slide: HomepageSlide) => {
    const confirmed = await confirm({
      title: `Delete "${slide.title}"?`,
      message: 'This removes the slide from the home page immediately.',
      consequences: ['Cannot be undone'],
      confirmLabel: 'Delete slide',
    });
    if (!confirmed) return;

    setPendingDeleteId(slide.id);
    try {
      const response = await adminFetch(`/api/admin/homepage-slides/${slide.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) fetchSlides();
      else toast.error(data.error || 'Failed to delete slide');
    } catch {
      toast.error('Network error');
    } finally {
      setPendingDeleteId(null);
    }
  };

  return {
    slides: [...slides].sort((a, b) => a.sort_order - b.sort_order),
    loading,
    error,
    editingSlide,
    isModalOpen,
    isSaving,
    pendingDeleteId,
    openCreateModal,
    openEditModal,
    closeModal,
    saveSlide,
    toggleActive,
    move,
    deleteSlide,
  };
}
