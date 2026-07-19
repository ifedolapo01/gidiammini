/** ADMIN layer — variant (size/color) state and derived data for the product form. */
'use client';

import { useMemo, useState } from 'react';
import { VariantSize, toTitleCase } from '@/lib/commerce/product-form-helpers';

const emptyVariant = (): VariantSize => ({ size: '', price: 0, stock: 0, colors: [] });

export function useProductVariants() {
  const [hasVariants, setHasVariants] = useState(false);
  const [hasSizes, setHasSizes] = useState(false);
  const [hasColors, setHasColors] = useState(false);
  const [sizingType, setSizingType] = useState<'size' | 'age'>('size');
  const [variants, setVariants] = useState<VariantSize[]>([emptyVariant()]);

  const uniqueColorsArray = useMemo(() => {
    if (!hasVariants || !hasColors) return [];
    const colors = new Set<string>();
    variants.forEach((v) => {
      v.colors.forEach((c) => {
        const cn = c.name.trim();
        if (cn) colors.add(cn);
      });
    });
    return Array.from(colors);
  }, [hasVariants, hasColors, variants]);

  const uniqueColorsCount = uniqueColorsArray.length;

  /** The "Product has multiple options" toggle also resets sizes/colors flags. */
  const toggleHasVariants = (checked: boolean) => {
    setHasVariants(checked);
    if (!checked) {
      setHasSizes(false);
      setHasColors(false);
    } else {
      setHasSizes(true);
      setHasColors(true);
    }
  };

  const addVariant = () => {
    setVariants((prev) => [...prev, { size: '', price: 0, stock: 0, colors: [{ name: '', price: 0, stock: 0 }] }]);
  };

  const removeVariant = (vIdx: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== vIdx));
  };

  const updateVariantSize = (vIdx: number, value: string) => {
    setVariants((prev) => {
      const next = [...prev];
      next[vIdx] = { ...next[vIdx], size: value };
      return next;
    });
  };

  const updateVariantPrice = (vIdx: number, value: number) => {
    setVariants((prev) => {
      const next = [...prev];
      next[vIdx] = { ...next[vIdx], price: value };
      return next;
    });
  };

  const updateVariantStock = (vIdx: number, value: number) => {
    setVariants((prev) => {
      const next = [...prev];
      next[vIdx] = { ...next[vIdx], stock: value };
      return next;
    });
  };

  const blurVariantSize = (vIdx: number) => {
    setVariants((prev) => {
      const val = prev[vIdx].size;
      if (!val) return prev;
      const next = [...prev];
      next[vIdx] = { ...next[vIdx], size: toTitleCase(val) };
      return next;
    });
  };

  const addColorToVariant = (vIdx: number) => {
    setVariants((prev) => {
      const next = [...prev];
      next[vIdx] = { ...next[vIdx], colors: [...next[vIdx].colors, { name: '', price: 0, stock: 0 }] };
      return next;
    });
  };

  const removeColorFromVariant = (vIdx: number, cIdx: number) => {
    setVariants((prev) => {
      const next = [...prev];
      next[vIdx] = { ...next[vIdx], colors: next[vIdx].colors.filter((_, i) => i !== cIdx) };
      return next;
    });
  };

  const updateColorName = (vIdx: number, cIdx: number, value: string) => {
    setVariants((prev) => {
      const next = [...prev];
      const colors = [...next[vIdx].colors];
      colors[cIdx] = { ...colors[cIdx], name: value };
      next[vIdx] = { ...next[vIdx], colors };
      return next;
    });
  };

  const updateColorPrice = (vIdx: number, cIdx: number, value: number) => {
    setVariants((prev) => {
      const next = [...prev];
      const colors = [...next[vIdx].colors];
      colors[cIdx] = { ...colors[cIdx], price: value };
      next[vIdx] = { ...next[vIdx], colors };
      return next;
    });
  };

  const updateColorStock = (vIdx: number, cIdx: number, value: number) => {
    setVariants((prev) => {
      const next = [...prev];
      const colors = [...next[vIdx].colors];
      colors[cIdx] = { ...colors[cIdx], stock: value };
      next[vIdx] = { ...next[vIdx], colors };
      return next;
    });
  };

  const blurColorName = (vIdx: number, cIdx: number) => {
    setVariants((prev) => {
      const val = prev[vIdx].colors[cIdx].name;
      if (!val) return prev;
      const next = [...prev];
      const colors = [...next[vIdx].colors];
      colors[cIdx] = { ...colors[cIdx], name: toTitleCase(val) };
      next[vIdx] = { ...next[vIdx], colors };
      return next;
    });
  };

  return {
    hasVariants, setHasVariants, toggleHasVariants,
    hasSizes, setHasSizes,
    hasColors, setHasColors,
    sizingType, setSizingType,
    variants, setVariants,
    uniqueColorsArray, uniqueColorsCount,
    addVariant, removeVariant,
    updateVariantSize, updateVariantPrice, updateVariantStock, blurVariantSize,
    addColorToVariant, removeColorFromVariant,
    updateColorName, updateColorPrice, updateColorStock, blurColorName,
  };
}
