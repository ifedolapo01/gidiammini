/** ADMIN layer — single-image selection, compression and upload for one slide.
 *
 * A trimmed useProductImages: a slide has exactly one photo and no per-image
 * colour assignment, so the gallery/multi-select state that hook carries has
 * nothing to attach to here. Uploading still goes through the same server
 * action and the same compression helper — there is no reason a slide photo
 * should skip either.
 */
'use client';

import { useRef, useState } from 'react';
import { uploadProductImage } from '@/app/actions/upload';
import { compressImage } from '@/lib/commerce/image-compression';
import { notifyAdminSessionExpired } from '@/app/admin/lib/admin-fetch';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const COMPRESSION_THRESHOLD = 1 * 1024 * 1024;

export interface SlideImageState {
  file: File | null;
  url: string;
}

export function useSlideImage(initialUrl: string = '') {
  const [image, setImage] = useState<SlideImageState | null>(initialUrl ? { file: null, url: initialUrl } : null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(`Invalid file type: ${file.type}`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError(`Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 10MB.`);
      return;
    }

    setIsCompressing(true);
    try {
      const processed = file.size > COMPRESSION_THRESHOLD ? await compressImage(file) : file;
      setImage({ file: processed, url: URL.createObjectURL(processed) });
    } catch (caught: any) {
      setError(`Failed to process ${file.name}: ${caught.message}`);
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = () => {
    if (image?.file) URL.revokeObjectURL(image.url);
    setImage(null);
  };

  /** Uploads the picked file, if any; an untouched existing URL is returned as-is. */
  const uploadForSubmit = async (): Promise<string> => {
    if (!image) throw new Error('An image is required');
    if (!image.file) return image.url;

    const formData = new FormData();
    formData.append('image', image.file);
    const result = await uploadProductImage(formData);
    if (result.error || !result.url) {
      if (result.unauthorized) notifyAdminSessionExpired();
      throw new Error(result.error || 'Upload failed');
    }
    return result.url;
  };

  return { image, isCompressing, error, fileInputRef, handleImageChange, removeImage, uploadForSubmit };
}
