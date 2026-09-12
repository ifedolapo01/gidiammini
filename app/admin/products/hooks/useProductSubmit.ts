/** ADMIN layer — shared validate + build-variant-rows + upload + save orchestration for product create/edit. */
'use client';

import { useState } from 'react';
import { SubmitHandler } from 'react-hook-form';
import { ProductFormValues } from '@/lib/commerce/product-form-schema';
import { buildVariantRowsFromForm, ImageFile, saveProduct, VariantSize } from '@/lib/commerce/product-form-helpers';
import { toMinorUnits } from '@/lib/commerce/money';
import type { SizingType } from '@/lib/commerce/product-form-schema';
import { adminFetch } from '@/app/admin/lib/admin-fetch';

interface UseProductSubmitArgs {
  /** Present (and truthy) only on the edit page; triggers a PUT instead of a POST. */
  productId?: string;
  hasVariants: boolean;
  hasSizes: boolean;
  hasColors: boolean;
  variants: VariantSize[];
  sizingType: SizingType;
  images: ImageFile[];
  isCompressing: boolean;
  uploadAllForSubmit: () => Promise<{ mainImageUrl: string; additionalImages: string[]; colorImagesMap: Record<string, string> }>;
  onSuccess?: () => void;
}

export function useProductSubmit(args: UseProductSubmitArgs) {
  const { productId, hasVariants, hasSizes, hasColors, variants, sizingType, images, isCompressing, uploadAllForSubmit, onSuccess } = args;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  const onSubmit: SubmitHandler<ProductFormValues> = async (data) => {
    if (productId !== undefined && !productId) {
      setSubmitError('Product ID is missing');
      return;
    }

    if (images.length === 0) {
      setSubmitError('Please add at least one product image');
      return;
    }

    const mainImage = images.find((img) => img.isMain);
    if (!mainImage) {
      setSubmitError('Please select a main image (click the star icon on any image)');
      return;
    }

    if (isCompressing) {
      setSubmitError('Please wait for image compression to complete');
      return;
    }

    // The form displays and edits Naira throughout — see useEditProductData's
    // matching fromMinorUnits on load. This is the one place it becomes minor
    // units, right before anything is built for the API.
    const minorVariants: VariantSize[] = variants.map((v) => ({
      ...v,
      price: toMinorUnits(v.price),
      cost: v.cost == null ? null : toMinorUnits(v.cost),
      colors: v.colors.map((c) => ({
        ...c,
        price: toMinorUnits(c.price),
        cost: c.cost == null ? null : toMinorUnits(c.cost),
      })),
    }));

    const variantParams = {
      hasVariants,
      hasSizes,
      hasColors,
      variants: minorVariants,
      singlePrice: toMinorUnits(data.price),
      singleStock: data.stock,
      singleSize: data.singleSize,
      singleColor: data.singleColor,
      // An empty cost field means "not recorded", so it must reach
      // buildVariantRowsFromForm as null rather than being coerced to 0.
      singleCost: data.cost === '' || data.cost === undefined ? null : toMinorUnits(Number(data.cost)),
    };

    const { variants: variantRows, totalStock, minPrice, uniqueSizes, uniqueColors } =
      buildVariantRowsFromForm(variantParams);

    if (variantRows.length === 0) {
      setSubmitError('Please add at least one size, colour or price.');
      return;
    }

    if (hasVariants && hasColors && uniqueColors.size > 0 && images.length < uniqueColors.size) {
      setSubmitError(
        `Please upload at least ${uniqueColors.size} images (you have ${images.length}) to correspond with your ${uniqueColors.size} unique colors.`,
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    setSuccess(false);

    try {
      const { mainImageUrl, additionalImages, colorImagesMap } = await uploadAllForSubmit();

      // A row's image_url comes from whichever photo the form currently has
      // assigned to its colour. A colour with no assigned photo sends no
      // image_url at all (rather than null), so replace_product_variants
      // leaves whatever was stored there before untouched.
      const variantsWithImages = variantRows.map((row) =>
        row.color && colorImagesMap[row.color]
          ? { ...row, image_url: colorImagesMap[row.color] }
          : row
      );

      await saveProduct(
        {
          name: data.name,
          description: data.description,
          price: minPrice === Infinity ? 0 : minPrice,
          category: data.category,
          sub_category: data.sub_category,
          sub_sub_category: data.sub_sub_category,
          main_image: mainImageUrl,
          images: additionalImages,
          variants: variantsWithImages,
          colors: Array.from(uniqueColors),
          sizes: Array.from(uniqueSizes),
          sizing_type: sizingType,
          stock: totalStock,
          details: data.details?.map((d) => d.value).filter((d) => d.trim() !== '') || [],
          // '' from the radio group means "not recorded"; buildProduct*Payload
          // stores that as NULL, so the storefront shows nothing rather than a
          // fit claim nobody made.
          fit_rating: data.fit_rating,
          fit_note: data.fit_note,
        },
        productId,
        adminFetch,
      );

      setSuccess(true);
      onSuccess?.();
    } catch (error: any) {
      setSubmitError(error.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return { onSubmit, isSubmitting, submitError, setSubmitError, success, setSuccess };
}
