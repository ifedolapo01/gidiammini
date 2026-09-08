/** ADMIN layer — single-image dropzone for one homepage slide.
 *
 * A thin wrapper rather than a reuse of ProductImageUploader: that component's
 * gallery grid and per-image colour select exist for a product with many
 * photos and variants, neither of which a slide has. Sharing it would mean
 * passing empty arrays through props that only make sense for a catalogue
 * item — this is the same dropzone treatment with just the one image it needs.
 */
'use client';

import { Plus, Upload, X } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { IMAGE_FALLBACK_SRC } from '@/lib/image-placeholder';
import type { SlideImageState } from '../hooks/useSlideImage';

export interface SlideImageUploaderProps {
  image: SlideImageState | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isCompressing: boolean;
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
}

export function SlideImageUploader({
  image,
  fileInputRef,
  isCompressing,
  onImageChange,
  onRemoveImage,
}: SlideImageUploaderProps) {
  return (
    <div>
      <label className="block text-body-sm font-bold text-text-primary mb-2">
        Slide image <span className="text-destructive">*</span>
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onImageChange}
        className="hidden"
        id="slide-image-upload"
      />

      <div
        className={`border-2 border-dashed rounded-surface p-6 transition-colors ${image ? 'border-border' : 'border-border-strong bg-background-secondary hover:bg-background-tertiary'}`}
      >
        {!image ? (
          <div className="text-center">
            <div className="w-14 h-14 bg-surface border border-border rounded-surface flex items-center justify-center mx-auto mb-3 shadow-elevation-1">
              <Upload className="h-7 w-7 text-primary" />
            </div>
            <p className="text-text-primary font-medium mb-1">Click to upload a hero image</p>
            <p className="text-caption-md text-text-secondary mb-4">PNG, JPG, WEBP up to 10MB (auto-compressed)</p>
            <label
              htmlFor="slide-image-upload"
              className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-control font-semibold hover:bg-primary-hover cursor-pointer shadow-elevation-1 transition-all"
            >
              <Plus size={16} /> Add Image
            </label>
          </div>
        ) : (
          <div className="relative group rounded-surface overflow-hidden shadow-elevation-1 w-full max-w-md mx-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt="Slide preview"
              className="w-full h-auto block rounded-surface"
              onError={(event) => {
                (event.target as HTMLImageElement).src = IMAGE_FALLBACK_SRC;
              }}
            />
            <div className="absolute inset-0 bg-overlay opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={onRemoveImage}
                className="bg-surface p-2 rounded-control hover:bg-destructive-background hover:text-destructive transition-colors"
                title="Remove image"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {isCompressing && (
        <div className="flex items-center justify-center gap-2 text-primary bg-primary/10 py-2.5 mt-3 rounded-control border border-primary/20">
          <Spinner size="sm" className="text-primary" />
          <span className="text-body-sm font-medium">Optimizing image...</span>
        </div>
      )}
    </div>
  );
}
