/** ADMIN layer — target selector for a discount's scope. */
'use client';

import { Select } from '@/components/ui';
import type { Category, Product } from '@/types/product';
import type { VariantTarget } from '@/lib/commerce/discount-target';
import { VariantTargetPicker } from './VariantTargetPicker';

interface VariantTargetingProps {
  addedVariants: VariantTarget[];
  variantProductId: string;
  setVariantProductId: (id: string) => void;
  variantSize: string;
  setVariantSize: (size: string) => void;
  variantColor: string;
  setVariantColor: (color: string) => void;
  addVariant: () => void;
  removeVariant: (index: number) => void;
}

interface DiscountTargetFieldProps {
  scope: 'SITEWIDE' | 'CATEGORY' | 'SUBCATEGORY' | 'PRODUCT' | 'VARIANT';
  targetId: string;
  onTargetIdChange: (value: string) => void;
  categories: Category[];
  products: Product[];
  variantTargeting: VariantTargetingProps;
}

export function DiscountTargetField({
  scope,
  targetId,
  onTargetIdChange,
  categories,
  products,
  variantTargeting,
}: DiscountTargetFieldProps) {
  if (scope === 'SITEWIDE') return null;

  return (
    <div>
      <label className="block text-body-sm font-semibold text-text-primary mb-1.5">Target</label>
      {scope === 'CATEGORY' && (
        <Select
          value={targetId}
          onChange={(e) => onTargetIdChange(e.target.value)}
          required
        >
          <option value="">Select a category...</option>
          {categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </Select>
      )}

      {scope === 'SUBCATEGORY' && (
        <Select
          value={targetId}
          onChange={(e) => onTargetIdChange(e.target.value)}
          required
        >
          <option value="">Select a subcategory...</option>
          {categories.flatMap(c => c.subcategories || []).map(s => (
            <option key={s.id} value={s.slug}>{s.name}</option>
          ))}
        </Select>
      )}

      {scope === 'PRODUCT' && (
        <Select
          value={targetId}
          onChange={(e) => onTargetIdChange(e.target.value)}
          required
        >
          <option value="">Select a product...</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      )}

      {scope === 'VARIANT' && (
        <VariantTargetPicker
          products={products}
          variantProductId={variantTargeting.variantProductId}
          setVariantProductId={variantTargeting.setVariantProductId}
          variantSize={variantTargeting.variantSize}
          setVariantSize={variantTargeting.setVariantSize}
          variantColor={variantTargeting.variantColor}
          setVariantColor={variantTargeting.setVariantColor}
          addedVariants={variantTargeting.addedVariants}
          onAddVariant={variantTargeting.addVariant}
          onRemoveVariant={variantTargeting.removeVariant}
        />
      )}
    </div>
  );
}
