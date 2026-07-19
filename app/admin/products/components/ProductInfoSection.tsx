/** ADMIN layer — product name/description/category/subcategory fields. */
'use client';

import { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Input, Textarea, Select } from '@/components/ui';
import { Category } from '@/types/product';
import { ProductFormValues } from '@/lib/commerce/product-form-schema';

export interface ProductInfoSectionProps {
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  handleTitleCaseBlur: (fieldPath: any) => void;
  categories: Category[];
  loadingCategories: boolean;
  selectedCategory?: Category;
}

export function ProductInfoSection({
  register,
  errors,
  handleTitleCaseBlur,
  categories,
  loadingCategories,
  selectedCategory,
}: ProductInfoSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-body-sm font-bold text-text-primary mb-2">
          Product Name <span className="text-destructive">*</span>
        </label>
        <Input
          {...register('name', { onBlur: () => handleTitleCaseBlur('name') })}
          type="text"
          invalid={!!errors.name}
          placeholder="e.g., Premium Cotton Tee"
        />
        {errors.name && <p className="text-destructive text-body-sm mt-1.5">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-body-sm font-bold text-text-primary mb-2">Description</label>
        <Textarea
          {...register('description')}
          invalid={!!errors.description}
          className="h-32"
          placeholder="Describe your product beautifully..."
        />
        {errors.description && <p className="text-destructive text-body-sm mt-1.5">{errors.description.message}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-body-sm font-bold text-text-primary mb-2">
            Category <span className="text-destructive">*</span>
          </label>
          <Select {...register('category')} invalid={!!errors.category} disabled={loadingCategories}>
            <option value="">Select a category...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </Select>
          {errors.category && <p className="text-destructive text-body-sm mt-1.5">{errors.category.message}</p>}
        </div>

        {selectedCategory && selectedCategory.subcategories && selectedCategory.subcategories.length > 0 && (
          <div>
            <label className="block text-body-sm font-bold text-text-primary mb-2">Subcategory</label>
            <Select {...register('sub_category')} invalid={!!errors.sub_category}>
              <option value="">No subcategory (optional)</option>
              {selectedCategory.subcategories.map((sub) => (
                <option key={sub.id} value={sub.slug}>
                  {sub.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
