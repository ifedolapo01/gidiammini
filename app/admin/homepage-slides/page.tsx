/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/homepage-slides/page.tsx - the home page hero, curated.
//
// The hero carousel used to be three PNGs imported at build time with the copy
// hardcoded beside them (components/HeroCarousel.tsx) — changing a headline or
// running a seasonal banner meant an engineer and a deploy. This is that lever.
'use client';

import { Plus } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { useHomepageSlides } from './hooks/useHomepageSlides';
import { SlideList } from './components/SlideList';
import { SlideFormModal } from './components/SlideFormModal';

export default function HomepageSlidesPage() {
  const {
    slides,
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
  } = useHomepageSlides();

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-h4 font-bold text-text-primary">Homepage Hero</h1>
          <p className="text-text-secondary">
            The slides that rotate at the top of the home page. Reorder, schedule, or turn one off without a deploy.
          </p>
        </div>
        <Button onClick={openCreateModal} className="shadow-elevation-1">
          <Plus size={18} />
          Add Slide
        </Button>
      </div>

      {error && (
        <div className="bg-destructive-background text-destructive p-4 rounded-control border border-destructive-border">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" className="text-primary" />
        </div>
      ) : (
        <SlideList
          slides={slides}
          pendingDeleteId={pendingDeleteId}
          onEdit={openEditModal}
          onDelete={deleteSlide}
          onToggleActive={toggleActive}
          onMove={move}
        />
      )}

      <SlideFormModal
        isOpen={isModalOpen}
        editingSlide={editingSlide}
        isSaving={isSaving}
        onClose={closeModal}
        onSave={saveSlide}
      />
    </div>
  );
}
