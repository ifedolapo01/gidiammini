/** ADMIN layer — shared validate + build-pricing-config + upload + save orchestration for product create/edit. */
'use client';

import { useState } from 'react';
import { SubmitHandler } from 'react-hook-form';
import { ProductFormValues } from '@/lib/commerce/product-form-schema';
import { buildPricingConfigFromVariants, ImageFile, saveProduct, VariantSize } from '@/lib/commerce/product-form-helpers';
import { buildVariantCosts } from '@/lib/commerce/variant-costs';
import type { SizingType } from '@/lib/commerce/product-form-schema';

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

    const variantParams = {
      hasVariants,
      hasSizes,
      hasColors,
      variants,
      singlePrice: data.price,
      singleStock: data.stock,
      singleSize: data.singleSize,
      singleColor: data.singleColor,
      // An empty cost field means "not recorded", so it must reach
      // buildVariantCosts as null rather than being coerced to 0.
      singleCost: data.cost === '' || data.cost === undefined ? null : Number(data.cost),
    };

    const { pricingConfig, totalStock, minPrice, uniqueSizes, uniqueColors } =
      buildPricingConfigFromVariants(variantParams);

    // Costs travel beside pricing_config, not inside it — see
    // lib/commerce/variant-costs.ts.
    const variantCosts = buildVariantCosts(variantParams);

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
      if (Object.keys(colorImagesMap).length > 0) {
        pricingConfig.colorImages = colorImagesMap;
      }

      await saveProduct(
        {
          name: data.name,
          description: data.description,
          price: minPrice === Infinity ? 0 : minPrice,
          category: data.category,
          sub_category: data.sub_category,
          main_image: mainImageUrl,
          images: additionalImages,
          variant_costs: variantCosts,
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
          pricing_config: pricingConfig,
        },
        productId,
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
