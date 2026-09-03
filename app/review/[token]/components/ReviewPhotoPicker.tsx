/**
 * STOREFRONT layer — attaching photos to a review.
 *
 * Each photo uploads as soon as it is chosen, rather than travelling with the
 * submit. On a Nigerian mobile connection a four-photo review is the slowest
 * thing on this page by an order of magnitude, and a single submit that
 * uploads everything at once is a spinner with no progress and one failure
 * mode for the whole form. This way each photo either lands or doesn't, and
 * the review itself stays a small JSON post.
 *
 * Compressed in the browser first, with the same helper the admin product
 * uploader uses — a modern phone photo is 4-8MB, which is over the limit
 * before it has left the device.
 */
'use client';

import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { compressImage } from '@/lib/commerce/image-compression';
import { ACCEPTED_IMAGE_ACCEPT } from '@/lib/commerce/image-file';
import { MAX_REVIEW_PHOTOS } from '@/lib/commerce/reviews';

interface ReviewPhotoPickerProps {
  token: string;
  /** Object paths already uploaded, owned by the parent form. */
  paths: string[];
  onChange: (paths: string[]) => void;
  disabled?: boolean;
}

export default function ReviewPhotoPicker({
  token,
  paths,
  onChange,
  disabled = false,
}: ReviewPhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  // Local object URLs, so a thumbnail appears without waiting for the upload
  // to come back and without reading the public bucket.
  const [previews, setPreviews] = useState<string[]>([]);

  const full = paths.length >= MAX_REVIEW_PHOTOS;

  async function upload(files: FileList) {
    setError('');
    const room = MAX_REVIEW_PHOTOS - paths.length;
    const chosen = [...files].slice(0, room);
    if (chosen.length === 0) return;

    setUploading(true);
    const added: string[] = [];
    const addedPreviews: string[] = [];

    for (const file of chosen) {
      try {
        const body = new FormData();
        body.append('photo', await compressImage(file));
        body.append('token', token);

        const response = await fetch('/api/reviews/photos', { method: 'POST', body });
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.success) {
          setError(result?.error || 'That photo could not be uploaded. Please try another.');
          continue;
        }

        added.push(result.path);
        addedPreviews.push(URL.createObjectURL(file));
      } catch {
        setError('We could not reach the server. Please check your connection.');
      }
    }

    if (added.length > 0) {
      onChange([...paths, ...added]);
      setPreviews((current) => [...current, ...addedPreviews]);
    }

    setUploading(false);
    // Cleared so choosing the same file again still fires a change event.
    if (inputRef.current) inputRef.current.value = '';
  }

  /** Removes it from the review. The object stays in the bucket unreferenced —
   *  deleting it would need a second endpoint that can delete by path, which
   *  is a bigger hole than an orphaned thumbnail. */
  function remove(index: number) {
    onChange(paths.filter((_, at) => at !== index));
    setPreviews((current) => current.filter((_, at) => at !== index));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {previews.map((preview, index) => (
          <div key={paths[index] ?? preview} className="relative">
            {/* A raw <img>: this is a local blob: URL that exists only in this
                browser for the length of the form, so there is nothing for
                next/image to optimise or cache. */}
            <img
              src={preview}
              alt={`Photo ${index + 1} attached to your review`}
              className="h-20 w-20 rounded-control border border-border object-cover"
            />
            <button
              type="button"
              onClick={() => remove(index)}
              disabled={disabled || uploading}
              aria-label={`Remove photo ${index + 1}`}
              className="absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface text-text-secondary shadow-elevation-2 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}

        {!full && (
          <>
            <input
              ref={inputRef}
              id={`review-photos-${token.slice(0, 8)}`}
              type="file"
              accept={ACCEPTED_IMAGE_ACCEPT}
              multiple
              className="sr-only"
              disabled={disabled || uploading}
              onChange={(event) => event.target.files && upload(event.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={uploading}
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              {/* Button draws its own spinner over the label while loading. */}
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              Add a photo
            </Button>
          </>
        )}
      </div>

      {error ? (
        <p role="alert" className="mt-1.5 text-caption-md text-destructive">
          {error}
        </p>
      ) : (
        <p className="mt-1.5 text-caption-md text-text-secondary">
          Optional — up to {MAX_REVIEW_PHOTOS} photos. A photo of it being worn
          helps more than anything else you can write.
        </p>
      )}
    </div>
  );
}
