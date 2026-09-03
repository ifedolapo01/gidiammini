/** ADMIN layer — fetches an existing product and hydrates the shared product-form state (edit page only). */
'use client';

import { useEffect, useState } from 'react';
import type { UseFormReset } from 'react-hook-form';
import { Product } from '@/types/product';
import { ProductFormValues } from '@/lib/commerce/product-form-schema';
import { ImageFile, VariantColor, VariantSize } from '@/lib/commerce/product-form-helpers';
import { variantKeyFor } from '@/lib/commerce/product-variants';
import type { SizingType } from '@/lib/commerce/product-form-schema';

interface UseEditProductDataArgs {
  productId: string;
  reset: UseFormReset<ProductFormValues>;
  setImages: (images: ImageFile[]) => void;
  setHasVariants: (value: boolean) => void;
  setHasSizes: (value: boolean) => void;
  setHasColors: (value: boolean) => void;
  setSizingType: (value: SizingType) => void;
  setVariants: (value: VariantSize[]) => void;
}

export function useEditProductData(args: UseEditProductDataArgs) {
  const { productId, reset, setImages, setHasVariants, setHasSizes, setHasColors, setSizingType, setVariants } = args;
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const fetchProduct = async (id: string) => {
    setIsLoading(true);
    setLoadError('');

    try {
      let productData: Product | null = null;

      const allProductsResponse = await fetch('/api/admin/products', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (allProductsResponse.ok) {
        const allProductsResult = await allProductsResponse.json();
        if (allProductsResult.success) {
          productData = allProductsResult.products.find((p: Product) => p.id === id);
        }
      }

      if (!productData) {
        const response = await fetch(`/api/admin/products/${id}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          if (response.status === 404) throw new Error('Product not found. It may have been deleted.');
          throw new Error(`Failed to load product (Status: ${response.status})`);
        }

        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Failed to load product');
        productData = result.product;
      }

      if (productData) {
        setProduct(productData);

        // Cost lives on product_variants, not in pricing_config, so it is
        // reloaded from the embedded rows and keyed the same way the database
        // keys them.
        const costFor = (size: string | null, color: string | null): number | null => {
          const key = variantKeyFor(size, color);
          const row = (productData?.product_variants ?? []).find((v) => v.variant_key === key);
          return typeof row?.cost === 'number' ? row.cost : null;
        };

        reset({
          name: productData.name,
          description: productData.description || '',
          price: productData.price,
          category: productData.category || '',
          sub_category: (productData as any).sub_category || '',
          singleSize: productData.pricing_config?.singleSize || '',
          singleColor: productData.pricing_config?.singleColor || '',
          stock: productData.stock,
          // '' rather than 0 for an unrecorded cost — see the note in
          // lib/commerce/product-form-schema.ts.
          cost: costFor(
            productData.pricing_config?.singleSize ?? null,
            productData.pricing_config?.singleColor ?? null,
          ) ?? '',
          sizing_type: productData.sizing_type || 'size',
          fit_rating: (productData as any).fit_rating || '',
          fit_note: (productData as any).fit_note || '',
          colors: productData.colors.length > 0 ? productData.colors.map((c) => ({ value: c })) : [{ value: '' }],
          sizes: productData.sizes.length > 0 ? productData.sizes.map((s) => ({ value: s })) : [{ value: '' }],
          details: productData.details.length > 0 ? productData.details.map((d) => ({ value: d })) : [{ value: '' }],
        });

        const colorImagesMap = productData.pricing_config?.colorImages || {};
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

        if (productData.pricing_config) {
          const config = productData.pricing_config;
          setSizingType(productData.sizing_type || 'size');

          if (config.mode === 'single') {
            setHasVariants(false);
            setHasSizes(false);
            setHasColors(false);
            setVariants([{ size: '', price: productData.price, stock: config.singleStock || productData.stock, cost: null, colors: [] }]);
          } else {
            setHasVariants(true);
            const newVariants: VariantSize[] = [];

            if (config.mode === 'combination') {
              setHasSizes(true);
              setHasColors(true);

              const prices = config.combinationPrices || {};
              const stocks = config.combinationStock || {};
              const sizeMap = new Map<string, VariantColor[]>();

              Object.keys(prices).forEach((key) => {
                const [size, color] = key.split('|');
                if (size && color) {
                  if (!sizeMap.has(size)) sizeMap.set(size, []);
                  sizeMap.get(size)!.push({ name: color, price: prices[key] || 0, stock: stocks[key] || 0, cost: costFor(size, color) });
                }
              });

              sizeMap.forEach((colors, size) => {
                newVariants.push({ size, price: 0, stock: 0, cost: null, colors });
              });

              if (newVariants.length === 0) newVariants.push({ size: '', price: 0, stock: 0, cost: null, colors: [] });
            } else if (config.mode === 'size') {
              setHasSizes(true);
              setHasColors(false);

              const prices = config.sizePrices || {};
              const stocks = config.sizeStock || {};

              Object.keys(prices).forEach((size) => {
                newVariants.push({ size, price: prices[size] || 0, stock: stocks[size] || 0, cost: costFor(size, null), colors: [] });
              });

              if (newVariants.length === 0) newVariants.push({ size: '', price: 0, stock: 0, cost: null, colors: [] });
            } else if (config.mode === 'color') {
              setHasSizes(false);
              setHasColors(true);

              const prices = config.colorPrices || {};
              const stocks = config.colorStock || {};
              const colors: VariantColor[] = [];

              Object.keys(prices).forEach((color) => {
                colors.push({ name: color, price: prices[color] || 0, stock: stocks[color] || 0, cost: costFor(null, color) });
              });

              newVariants.push({ size: '', price: 0, stock: 0, colors });
            }

            setVariants(newVariants);
          }
        } else {
          setHasVariants(false);
          setVariants([{ size: '', price: productData.price, stock: productData.stock, colors: [] }]);
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

  return { product, isLoading, loadError, refetch: () => fetchProduct(productId) };
}
