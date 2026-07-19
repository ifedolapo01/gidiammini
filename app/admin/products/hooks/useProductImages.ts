/** ADMIN layer — product image selection/compression state and upload-on-submit logic. */
'use client';

import { useRef, useState } from 'react';
import { uploadProductImage } from '@/app/actions/upload';
import { compressImage } from '@/lib/commerce/image-compression';
import { ImageFile } from '@/lib/commerce/product-form-helpers';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const COMPRESSION_THRESHOLD = 1 * 1024 * 1024;

interface UseProductImagesOptions {
  /** New page has no pre-existing images, so the first upload becomes the main image. Edit page seeds its own main image on load. */
  autoMainOnFirst?: boolean;
  onUploadStart?: () => void;
  onUploadErrors?: (message: string) => void;
}

export function useProductImages(options: UseProductImagesOptions = {}) {
  const { autoMainOnFirst = true, onUploadStart, onUploadErrors } = options;
  const [images, setImages] = useState<ImageFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  const handleImageUpload = async (files: FileList) => {
    const newImages: ImageFile[] = [];
    const imageErrors: string[] = [];

    setIsCompressing(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        if (!ALLOWED_TYPES.includes(file.type)) {
          imageErrors.push(`Invalid file type: ${file.type}. File: ${file.name}`);
          continue;
        }

        if (file.size > MAX_FILE_SIZE) {
          imageErrors.push(`Image too large (${(file.size / 1024 / 1024).toFixed(2)}MB): ${file.name}. Max 10MB.`);
          continue;
        }

        let processedFile = file;
        if (file.size > COMPRESSION_THRESHOLD) {
          processedFile = await compressImage(file);
        }

        const url = URL.createObjectURL(processedFile);
        newImages.push({
          file: processedFile,
          url,
          isMain: autoMainOnFirst && images.length === 0 && newImages.length === 0,
          isUploading: false,
        });
      } catch (error: any) {
        imageErrors.push(`Failed to process ${file.name}: ${error.message}`);
      }
    }

    setIsCompressing(false);

    setImages((prev) => {
      const updatedImages = [...prev];
      if (autoMainOnFirst && updatedImages.length === 0 && newImages.length > 0) {
        newImages[0].isMain = true;
      }
      return [...updatedImages, ...newImages];
    });

    if (imageErrors.length > 0) {
      onUploadErrors?.(`Some images failed to upload:\n${imageErrors.join('\n')}`);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    onUploadStart?.();
    await handleImageUpload(files);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const newImages = [...prev];
      const removedImage = newImages[index];
      if (removedImage.file) URL.revokeObjectURL(removedImage.url);
      newImages.splice(index, 1);
      if (removedImage.isMain && newImages.length > 0) {
        newImages[0].isMain = true;
      }
      return newImages;
    });
  };

  const setAsMainImage = (index: number) => {
    setImages((prev) => {
      const newImages = [...prev];
      newImages.forEach((img) => (img.isMain = false));
      newImages[index].isMain = true;
      return newImages;
    });
  };

  const assignImageColor = (index: number, color: string) => {
    setImages((prev) => {
      const newImages = [...prev];
      newImages[index] = { ...newImages[index], assignedColor: color };
      return newImages;
    });
  };

  /** Uploads any newly-added (local file) images, keeping already-hosted URLs as-is. */
  const uploadAllForSubmit = async () => {
    const uploadedImages: string[] = [];
    const colorImagesMap: Record<string, string> = {};

    for (const image of images) {
      let imageUrl = image.url;
      if (image.file) {
        const uploadFormData = new FormData();
        uploadFormData.append('image', image.file);
        const uploadResult = await uploadProductImage(uploadFormData);
        if (uploadResult.error) throw new Error(uploadResult.error);
        imageUrl = uploadResult.url!;
      }
      uploadedImages.push(imageUrl);

      if (image.assignedColor && !colorImagesMap[image.assignedColor]) {
        colorImagesMap[image.assignedColor] = imageUrl;
      }
    }

    const mainImageIndex = images.findIndex((img) => img.isMain);
    const mainImageUrl = uploadedImages[mainImageIndex];
    const additionalImages = uploadedImages.filter((_, index) => index !== mainImageIndex);

    return { mainImageUrl, additionalImages, colorImagesMap };
  };

  return {
    images, setImages, fileInputRef, isCompressing,
    handleImageChange, removeImage, setAsMainImage, assignImageColor,
    uploadAllForSubmit,
  };
}
