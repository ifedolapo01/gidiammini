/** ADMIN layer — product image dropzone, gallery grid, and per-image color assignment. */
'use client';

import { RefObject } from 'react';
import { Plus, Star, Upload, X } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { ImageFile } from '@/lib/commerce/product-form-helpers';

export interface ProductImageUploaderProps {
  images: ImageFile[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  isCompressing: boolean;
  uniqueColorsArray: string[];
  uniqueColorsCount: number;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
  onSetAsMainImage: (index: number) => void;
  onAssignImageColor: (index: number, color: string) => void;
}

export function ProductImageUploader({
  images,
  fileInputRef,
  isCompressing,
  uniqueColorsArray,
  uniqueColorsCount,
  onImageChange,
  onRemoveImage,
  onSetAsMainImage,
  onAssignImageColor,
}: ProductImageUploaderProps) {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
        <div>
          <label className="block text-body-sm font-bold text-text-primary">
            Product Images <span className="text-destructive">*</span>
          </label>
          <p className="text-caption-md text-text-secondary mt-0.5">Upload multiple. Click the star to set the main cover image.</p>
          {uniqueColorsCount > 0 && images.length < uniqueColorsCount && (
            <p className="text-caption-md font-bold text-warning mt-1">
              ⚠️ Please upload at least {uniqueColorsCount} image{uniqueColorsCount !== 1 ? 's' : ''} to show the different colors you entered.
            </p>
          )}
        </div>
        <span className="text-caption-md font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-control border border-primary/20">
          {images.length} image{images.length !== 1 ? 's' : ''} selected
        </span>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={onImageChange} className="hidden" id="image-upload" multiple />

      <div
        className={`border-2 border-dashed rounded-surface p-8 transition-colors ${images.length === 0 ? 'border-border-strong bg-background-secondary hover:bg-background-tertiary' : 'border-border'}`}
      >
        {images.length === 0 ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-surface border border-border rounded-surface flex items-center justify-center mx-auto mb-4 shadow-elevation-1">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <p className="text-text-primary font-medium mb-1">Click to upload product images</p>
            <p className="text-caption-md text-text-secondary mb-6">PNG, JPG, WEBP up to 10MB (auto-compressed)</p>
            <label
              htmlFor="image-upload"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-control font-semibold hover:bg-primary-hover cursor-pointer shadow-elevation-1 transition-all"
            >
              <Plus size={18} /> Add Images
            </label>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {images.map((image, index) => (
                <div key={index} className="flex flex-col h-full justify-end gap-2">
                  <div className="relative group rounded-surface overflow-hidden shadow-elevation-1 w-full">
                    <div
                      className={`absolute inset-0 border-4 rounded-surface z-10 pointer-events-none transition-colors ${image.isMain ? 'border-primary' : 'border-transparent'}`}
                    />
                    <img
                      src={image.url}
                      alt={`Product image ${index + 1}`}
                      className="w-full h-auto block rounded-surface"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=Error';
                      }}
                    />
                    {image.isMain && (
                      <div className="absolute top-2 left-2 z-20 bg-primary text-primary-foreground p-1.5 rounded-control shadow-elevation-1">
                        <Star size={14} fill="currentColor" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-overlay opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center gap-2">
                      {!image.isMain && (
                        <button
                          type="button"
                          onClick={() => onSetAsMainImage(index)}
                          className="bg-surface p-2 rounded-control hover:bg-primary/10 hover:text-primary transition-colors"
                          title="Set as main image"
                        >
                          <Star size={18} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRemoveImage(index)}
                        className="bg-surface p-2 rounded-control hover:bg-destructive-background hover:text-destructive transition-colors"
                        title="Remove image"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                  {uniqueColorsArray.length > 0 && (
                    <select
                      value={image.assignedColor || ''}
                      onChange={(e) => onAssignImageColor(index, e.target.value)}
                      className={`w-full text-caption-md py-2 px-2 rounded-control border-2 transition-colors focus-visible:border-focus ${image.assignedColor ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border bg-surface text-text-primary font-medium'}`}
                    >
                      <option value="">No Color Assigned</option>
                      {uniqueColorsArray.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
              <label
                htmlFor="image-upload"
                className="self-end w-full flex flex-col items-center justify-center aspect-square border-2 border-dashed border-border-strong rounded-surface cursor-pointer hover:bg-surface-hover hover:border-primary/40 transition-colors group"
              >
                <div className="w-10 h-10 bg-surface rounded-full flex items-center justify-center border border-border group-hover:border-primary/30 group-hover:text-primary mb-2 shadow-elevation-1">
                  <Plus size={20} />
                </div>
                <span className="text-caption-md font-medium text-text-secondary group-hover:text-primary">Add More</span>
              </label>
            </div>
            {isCompressing && (
              <div className="flex items-center justify-center gap-2 text-primary bg-primary/10 py-3 rounded-control border border-primary/20">
                <Spinner size="sm" className="text-primary" />
                <span className="text-body-sm font-medium">Optimizing images...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
