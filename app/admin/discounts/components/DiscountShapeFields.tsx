/** ADMIN layer — what kind of discount this is, and what it applies to.
 *
 * The type/value pair and the scope/target pair, together: they answer one
 * question between them, and the value field's behaviour depends on the type
 * beside it (free delivery has no amount to enter). Split from
 * DiscountFormModal.tsx, which is now the modal shell and the schedule.
 */
'use client';

import { Input, Select } from '@/components/ui';
import type { Category, Product } from '@/types/product';
import type { DiscountFormData } from '../hooks/useDiscounts';
import { DiscountTargetField } from './DiscountTargetField';

interface DiscountShapeFieldsProps {
  formData: DiscountFormData;
  setFormData: (data: DiscountFormData) => void;
  categories: Category[];
  products: Product[];
  variantTargeting: any;
}

export default function DiscountShapeFields({
  formData,
  setFormData,
  categories,
  products,
  variantTargeting,
}: DiscountShapeFieldsProps) {
  return (
    <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-body-sm font-semibold text-text-primary mb-1.5">Discount Type</label>
              <Select
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value as any})}
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (₦)</option>
                <option value="FREE_SHIPPING">Free delivery</option>
              </Select>
            </div>
            <div className={formData.type === 'FREE_SHIPPING' ? 'opacity-50' : undefined}>
              <label className="block text-body-sm font-semibold text-text-primary mb-1.5">Value</label>
              <div className="relative">
                {formData.type === 'FIXED' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">₦</span>}
                <Input
                  type="number" onFocus={(e) => e.target.select()}
                  value={formData.value}
                  onChange={(e) => setFormData({...formData, value: e.target.value})}
                  className={formData.type === 'FIXED' ? 'pl-7 pr-3' : undefined}
                  placeholder={formData.type === 'PERCENTAGE' ? 'e.g. 20' : 'e.g. 5000'}
                  min="0"
                  max={formData.type === 'PERCENTAGE' ? "100" : undefined}
                  // Free delivery waives whatever the zone charges, so there is
                  // no amount to enter — and `required` on a disabled field
                  // would block the form from ever submitting.
                  disabled={formData.type === 'FREE_SHIPPING'}
                  required={formData.type !== 'FREE_SHIPPING'}
                />
                {formData.type === 'PERCENTAGE' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">%</span>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-body-sm font-semibold text-text-primary mb-1.5">Scope</label>
              <Select
                value={formData.scope}
                onChange={(e) => setFormData({...formData, scope: e.target.value as any, target_id: ''})}
              >
                <option value="SITEWIDE">Sitewide</option>
                <option value="CATEGORY">Category</option>
                <option value="SUBCATEGORY">Subcategory</option>
                <option value="PRODUCT">Specific Product</option>
                <option value="VARIANT">Product Variant</option>
              </Select>
            </div>

            {/* Placed after scope and target because the answer depends on
                both: the same percentage is safe on one category and a loss on
                another. */}
            <DiscountTargetField
              scope={formData.scope}
              targetId={formData.target_id}
              onTargetIdChange={(value: string) => setFormData({...formData, target_id: value})}
              categories={categories}
              products={products}
              variantTargeting={variantTargeting}
            />
          </div>
    </>
  );
}
