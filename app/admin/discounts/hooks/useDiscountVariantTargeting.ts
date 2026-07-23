/** ADMIN layer — VARIANT-scope discount targeting: builds the addedVariants list and keeps formData.target_id in sync. */
'use client';

import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Product } from '@/types/product';
import { serializeVariantTargets, type VariantTarget } from '@/lib/commerce/discount-target';
import type { DiscountFormData } from './useDiscounts';

export function useDiscountVariantTargeting(
  scope: DiscountFormData['scope'],
  setFormData: Dispatch<SetStateAction<DiscountFormData>>,
  products: Product[]
) {
  const [addedVariants, setAddedVariants] = useState<VariantTarget[]>([]);
  const [variantProductId, setVariantProductId] = useState('');
  const [variantSize, setVariantSize] = useState('');
  const [variantColor, setVariantColor] = useState('');

  useEffect(() => {
    if (scope === 'VARIANT') {
      setFormData(prev => ({ ...prev, target_id: serializeVariantTargets(addedVariants) }));
    }
  }, [addedVariants, scope, setFormData]);

  useEffect(() => {
    if (variantProductId && variantSize && variantColor) {
      const selectedProduct = products.find(p => p.id === variantProductId);
      const config = selectedProduct?.pricing_config;
      let availableColors = selectedProduct?.colors || [];

      if (config && config.mode === 'combination') {
        const combinationPrices = config.combinationPrices || {};
        availableColors = Object.keys(combinationPrices)
          .filter(key => key.startsWith(`${variantSize}|`))
          .map(key => key.split('|')[1]);
      }

      if (!availableColors.includes(variantColor) && availableColors.length > 0) {
        setVariantColor('');
      }
    }
  }, [variantProductId, variantSize, variantColor, products]);

  const addVariant = () => {
    if (!variantProductId) return;

    const selectedProduct = products.find(p => p.id === variantProductId);
    const hasSizes = (selectedProduct?.sizes || []).length > 0;
    const hasColors = (selectedProduct?.colors || []).length > 0;

    if (hasSizes && !variantSize) return toast.error('Please select a size');
    if (hasColors && !variantColor) return toast.error('Please select a color');

    // Avoid duplicates
    const isDuplicate = addedVariants.some(v =>
      v.productId === variantProductId &&
      v.size === variantSize &&
      v.color === variantColor
    );

    if (isDuplicate) return toast.error('This variant has already been added.');

    setAddedVariants([...addedVariants, {
      productId: variantProductId,
      size: variantSize,
      color: variantColor
    }]);

    // Reset selections
    setVariantSize('');
    setVariantColor('');
  };

  const removeVariant = (index: number) => {
    setAddedVariants(addedVariants.filter((_, idx) => idx !== index));
  };

  /** Seeds the targeted-variants list when opening the edit/reuse modal for an existing VARIANT discount. */
  const seedVariants = (variants: VariantTarget[]) => {
    setAddedVariants(variants);
  };

  /** Clears all variant-targeting state, used when opening the "create new" modal. */
  const resetVariants = () => {
    setAddedVariants([]);
    setVariantProductId('');
    setVariantSize('');
    setVariantColor('');
  };

  return {
    addedVariants,
    variantProductId, setVariantProductId,
    variantSize, setVariantSize,
    variantColor, setVariantColor,
    addVariant, removeVariant,
    seedVariants, resetVariants,
  };
}
