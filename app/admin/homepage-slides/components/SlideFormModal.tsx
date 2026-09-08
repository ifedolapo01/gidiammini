/** ADMIN layer — create/edit form for one homepage slide. */
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Input, Modal, Textarea, Checkbox } from '@/components/ui';
import { useSlideImage } from '../hooks/useSlideImage';
import { SlideImageUploader } from './SlideImageUploader';
import type { HomepageSlide, SlideDraft } from '../hooks/useHomepageSlides';

/** <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm", not an ISO string
 *  with seconds and a timezone suffix. */
function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface SlideFormModalProps {
  isOpen: boolean;
  editingSlide: HomepageSlide | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (draft: SlideDraft) => Promise<void>;
}

export function SlideFormModal({ isOpen, editingSlide, isSaving, onClose, onSave }: SlideFormModalProps) {
  const [title, setTitle] = useState(editingSlide?.title ?? '');
  const [subtitle, setSubtitle] = useState(editingSlide?.subtitle ?? '');
  const [ctaLabel, setCtaLabel] = useState(editingSlide?.cta_label ?? 'Shop Now');
  const [ctaLink, setCtaLink] = useState(editingSlide?.cta_link ?? '/products');
  const [isActive, setIsActive] = useState(editingSlide?.is_active ?? true);
  const [startsAt, setStartsAt] = useState(toLocalInputValue(editingSlide?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInputValue(editingSlide?.ends_at ?? null));

  const slideImage = useSlideImage(editingSlide?.image_path ?? '');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      toast.error('Give the slide a title');
      return;
    }
    if (!slideImage.image) {
      toast.error('Add a hero image');
      return;
    }

    try {
      const imagePath = await slideImage.uploadForSubmit();
      await onSave({
        image_path: imagePath,
        title: title.trim(),
        subtitle: subtitle.trim(),
        cta_label: ctaLabel.trim() || 'Shop Now',
        cta_link: ctaLink.trim() || '/products',
        is_active: isActive,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      });
    } catch (caught: any) {
      toast.error(caught.message || 'Could not upload the image');
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={editingSlide ? 'Edit slide' : 'Add slide'}
      size="lg"
      scrollable
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <SlideImageUploader
          image={slideImage.image}
          fileInputRef={slideImage.fileInputRef}
          isCompressing={slideImage.isCompressing}
          onImageChange={slideImage.handleImageChange}
          onRemoveImage={slideImage.removeImage}
        />
        {slideImage.error && <p className="text-body-sm text-destructive">{slideImage.error}</p>}

        <div>
          <label className="block text-body-sm font-bold text-text-primary mb-1">
            Title <span className="text-destructive">*</span>
          </label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required />
        </div>

        <div>
          <label className="block text-body-sm font-bold text-text-primary mb-1">Subtitle</label>
          <Textarea value={subtitle} onChange={(event) => setSubtitle(event.target.value)} maxLength={500} rows={2} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-body-sm font-bold text-text-primary mb-1">Button label</label>
            <Input value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} maxLength={60} />
          </div>
          <div>
            <label className="block text-body-sm font-bold text-text-primary mb-1">Button link</label>
            <Input value={ctaLink} onChange={(event) => setCtaLink(event.target.value)} placeholder="/products?category=babies" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-body-sm font-bold text-text-primary mb-1">Starts showing</label>
            <Input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
            <p className="text-caption-md text-text-secondary mt-1">Empty means &ldquo;right away&rdquo;.</p>
          </div>
          <div>
            <label className="block text-body-sm font-bold text-text-primary mb-1">Stops showing</label>
            <Input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
            <p className="text-caption-md text-text-secondary mt-1">Empty means &ldquo;no expiry&rdquo;.</p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-body-sm font-medium text-text-primary">
          <Checkbox checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          Active
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving || slideImage.isCompressing}>
            {isSaving ? 'Saving…' : editingSlide ? 'Save changes' : 'Add slide'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
