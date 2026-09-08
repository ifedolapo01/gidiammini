/** ADMIN layer — the ordered list of homepage slides, with reorder/toggle/edit/delete. */
'use client';

import Image from 'next/image';
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import type { HomepageSlide } from '../hooks/useHomepageSlides';

function scheduleLabel(slide: HomepageSlide): string | null {
  const now = Date.now();
  if (slide.starts_at && new Date(slide.starts_at).getTime() > now) {
    return `Starts ${new Date(slide.starts_at).toLocaleDateString()}`;
  }
  if (slide.ends_at && new Date(slide.ends_at).getTime() < now) {
    return `Ended ${new Date(slide.ends_at).toLocaleDateString()}`;
  }
  if (slide.ends_at) {
    return `Ends ${new Date(slide.ends_at).toLocaleDateString()}`;
  }
  return null;
}

interface SlideListProps {
  slides: HomepageSlide[];
  pendingDeleteId: string | null;
  onEdit: (slide: HomepageSlide) => void;
  onDelete: (slide: HomepageSlide) => void;
  onToggleActive: (slide: HomepageSlide) => void;
  onMove: (slide: HomepageSlide, direction: 'up' | 'down') => void;
}

export function SlideList({ slides, pendingDeleteId, onEdit, onDelete, onToggleActive, onMove }: SlideListProps) {
  if (slides.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-border-strong rounded-surface">
        <p className="text-text-secondary">
          No slides yet — the home page falls back to its built-in default carousel until you add one.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {slides.map((slide, index) => {
        const schedule = scheduleLabel(slide);

        return (
          <li
            key={slide.id}
            className="flex items-center gap-4 p-4 bg-surface rounded-surface border border-border"
          >
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => onMove(slide, 'up')}
                disabled={index === 0}
                className="rounded-control p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none"
                aria-label="Move up"
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                onClick={() => onMove(slide, 'down')}
                disabled={index === slides.length - 1}
                className="rounded-control p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none"
                aria-label="Move down"
              >
                <ArrowDown size={16} />
              </button>
            </div>

            <div className="relative w-24 h-16 shrink-0 rounded-control overflow-hidden bg-background-secondary">
              <Image src={slide.image_path} alt="" fill sizes="96px" className="object-cover" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-bold text-text-primary truncate">{slide.title}</p>
              <p className="text-caption-md text-text-secondary truncate">
                {slide.cta_label} → {slide.cta_link}
                {schedule && <> · {schedule}</>}
              </p>
            </div>

            <label className="flex items-center gap-2 text-caption-md font-medium text-text-secondary shrink-0">
              <input
                type="checkbox"
                className="size-4 rounded-control border-border-strong accent-primary cursor-pointer"
                checked={slide.is_active}
                onChange={() => onToggleActive(slide)}
              />
              Active
            </label>

            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" variant="outline" onClick={() => onEdit(slide)} aria-label="Edit slide">
                <Pencil size={16} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelete(slide)}
                disabled={pendingDeleteId === slide.id}
                aria-label="Delete slide"
              >
                {pendingDeleteId === slide.id ? <Spinner size="sm" /> : <Trash2 size={16} />}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
