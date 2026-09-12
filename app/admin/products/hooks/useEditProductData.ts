/** ADMIN layer — fetches an existing product and hydrates the shared product-form state (edit page only). */
'use client';

import { useEffect, useState } from 'react';
import type { UseFormReset, UseFormSetValue } from 'react-hook-form';
import { Product } from '@/types/product';
import { ProductFormValues } from '@/lib/commerce/product-form-schema';
import { ImageFile, VariantColor, VariantSize } from '@/lib/commerce/product-form-helpers';
import { fromMinorUnits } from '@/lib/commerce/money';
import type { SizingType } from '@/lib/commerce/product-form-schema';
import { adminFetch } from '@/app/admin/lib/admin-fetch';

/** The customer side of the fit story — product_review_stats' fit counts for
 *  this one product, next to the admin's own claim on the form. */
export interface ReviewFitStats {
  runs_small_count: number;
  true_to_size_count: number;
  runs_large_count: number;
}

interface UseEditProductDataArgs {
  productId: string;
  reset: UseFormReset<ProductFormValues>;
  setValue: UseFormSetValue<ProductFormValues>;
  /** Whether the category select's options (fetched separately, in parallel
   *  with this product) have finished loading. */
  categoriesReady: boolean;
  setImages: (images: ImageFile[]) => void;
  setHasVariants: (value: boolean) => void;
  setHasSizes: (value: boolean) => void;
  setHasColors: (value: boolean) => void;
  setSizingType: (value: SizingType) => void;
  setVariants: (value: VariantSize[]) => void;
}

export function useEditProductData(args: UseEditProductDataArgs) {
  const { productId, reset, setValue, categoriesReady, setImages, setHasVariants, setHasSizes, setHasColors, setSizingType, setVariants } = args;
  const [product, setProduct] = useState<Product | null>(null);
  const [reviewFitStats, setReviewFitStats] = useState<ReviewFitStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const fetchProduct = async (id: string) => {
    setIsLoading(true);
    setLoadError('');

    try {
      // Straight to the single-product endpoint. This used to pull the whole
      // products list first and find the row in it, which is now a paged
      // query — the product being edited is usually not on page 1, and even
      // when it was, downloading the catalogue to read one row was never the
      // cheap path it looked like.
      const response = await adminFetch(`/api/admin/products/${id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        if (response.status === 404) throw new Error('Product not found. It may have been deleted.');
        throw new Error(`Failed to load product (Status: ${response.status})`);
      }

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to load product');

      const productData: Product | null = result.product ?? null;
      setReviewFitStats(result.reviewFitStats ?? null);

      if (productData) {
        setProduct(productData);

        // The grid this form edits is reconstructed from product_variants
        // rows directly — grouped by size, then color — rather than from a
        // stored "mode": which of size/color actually vary across the rows
        // *is* the mode, so nothing needs to say so separately.
        const rows = productData.product_variants ?? [];
        const soleRow = rows.length <= 1 ? rows[0] : undefined;
        const costOf = (cost: number | null | undefined): number | null =>
          typeof cost === 'number' ? fromMinorUnits(cost) : null;

        reset({
          name: productData.name,
          description: productData.description || '',
          price: fromMinorUnits(productData.price),
          category: productData.category || '',
          sub_category: (productData as any).sub_category || '',
          sub_sub_category: (productData as any).sub_sub_category || '',
          singleSize: soleRow?.size || '',
          singleColor: soleRow?.color || '',
          stock: productData.stock,
          // '' rather than 0 for an unrecorded cost — see the note in
          // lib/commerce/product-form-schema.ts.
          cost: costOf(soleRow?.cost) ?? '',
          sizing_type: productData.sizing_type || 'size',
          fit_rating: (productData as any).fit_rating || '',
          fit_note: (productData as any).fit_note || '',
          colors: productData.colors.length > 0 ? productData.colors.map((c) => ({ value: c })) : [{ value: '' }],
          sizes: productData.sizes.length > 0 ? productData.sizes.map((s) => ({ value: s })) : [{ value: '' }],
          details: productData.details.length > 0 ? productData.details.map((d) => ({ value: d })) : [{ value: '' }],
        });

        const colorImagesMap: Record<string, string> = {};
        for (const row of rows) {
          if (row.color && row.image_url) colorImagesMap[row.color] = row.image_url;
        }
        const getAssignedColor = (url: string) => {
          for (const [color, mappedUrl] of Object.entries(colorImagesMap)) {
            if (mappedUrl === url) return color;
          }
          return undefined;
        };

        const initialImages: ImageFile[] = [
          { file: null, url: productData.main_image, isMain: true, assignedColor: getAssignedColor(productData.main_image) },
          ...(productData.images || []).map((img: string) => ({ file: null, url: img, isMain: false, assignedColor: getAssignedColor(img) })),
        ];
        setImages(initialImages);

        setSizingType(productData.sizing_type || 'size');

        const distinctSizes = new Set(rows.map((r) => r.size).filter(Boolean));
        const distinctColors = new Set(rows.map((r) => r.color).filter(Boolean));

        if (rows.length <= 1) {
          setHasVariants(false);
          setHasSizes(false);
          setHasColors(false);
          setVariants([{
            size: '',
            price: fromMinorUnits(soleRow?.price ?? productData.price),
            stock: soleRow?.stock ?? productData.stock,
            cost: costOf(soleRow?.cost),
            colors: [],
          }]);
        } else {
          setHasVariants(true);
          const hasSizes = distinctSizes.size > 0;
          const hasColors = distinctColors.size > 0;
          setHasSizes(hasSizes);
          setHasColors(hasColors);

          const newVariants: VariantSize[] = [];

          if (hasSizes && hasColors) {
            const sizeMap = new Map<string, VariantColor[]>();
            rows.forEach((row) => {
              if (!row.size || !row.color) return;
              if (!sizeMap.has(row.size)) sizeMap.set(row.size, []);
              sizeMap.get(row.size)!.push({
                name: row.color,
                price: fromMinorUnits(row.price),
                stock: row.stock,
                cost: costOf(row.cost),
              });
            });
            sizeMap.forEach((colors, size) => newVariants.push({ size, price: 0, stock: 0, cost: null, colors }));
          } else if (hasSizes) {
            rows.forEach((row) => {
              if (!row.size) return;
              newVariants.push({ size: row.size, price: fromMinorUnits(row.price), stock: row.stock, cost: costOf(row.cost), colors: [] });
            });
          } else if (hasColors) {
            const colors: VariantColor[] = rows
              .filter((row) => row.color)
              .map((row) => ({ name: row.color as string, price: fromMinorUnits(row.price), stock: row.stock, cost: costOf(row.cost) }));
            newVariants.push({ size: '', price: 0, stock: 0, colors });
          }

          if (newVariants.length === 0) newVariants.push({ size: '', price: 0, stock: 0, cost: null, colors: [] });
          setVariants(newVariants);
        }
      }
    } catch (error: any) {
      setLoadError(error.message || 'Failed to load product');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (productId) fetchProduct(productId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // reset() above fires as soon as the product loads, but the category
  // <select> is native and uncontrolled — if the product arrives before the
  // categories list has rendered its <option>s (the two fetches run in
  // parallel, and either can win), setting its value to a slug with no
  // matching option yet is silently dropped and never retried. Re-applying
  // once the options actually exist closes that gap, whichever fetch was
  // slower.
  useEffect(() => {
    if (!product || !categoriesReady) return;
    setValue('category', product.category || '');
    setValue('sub_category', (product as any).sub_category || '');
    setValue('sub_sub_category', (product as any).sub_sub_category || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, categoriesReady]);

  return { product, reviewFitStats, isLoading, loadError, refetch: () => fetchProduct(productId) };
}
