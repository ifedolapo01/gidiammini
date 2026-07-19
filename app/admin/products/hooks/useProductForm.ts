/** ADMIN layer — RHF + zod wiring shared by the product create/edit forms. */
'use client';

import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productFormSchema, productFormDefaultValues, ProductFormValues } from '@/lib/commerce/product-form-schema';
import { toTitleCase } from '@/lib/commerce/product-form-helpers';

export function useProductForm() {
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema) as any,
    defaultValues: productFormDefaultValues,
  });

  const { control, setValue, getValues } = form;

  const {
    fields: detailFields,
    append: appendDetail,
    remove: removeDetail,
  } = useFieldArray<ProductFormValues, 'details'>({
    control,
    name: 'details',
  });

  /** Title-cases any string field on blur (e.g. product name, detail bullets). */
  const handleTitleCaseBlur = (fieldPath: any) => {
    const val = getValues(fieldPath);
    if (typeof val === 'string' && val) {
      setValue(fieldPath, toTitleCase(val), { shouldValidate: true, shouldDirty: true });
    }
  };

  const selectedCategorySlug = useWatch({ control, name: 'category' });

  return {
    ...form,
    detailFields,
    appendDetail,
    removeDetail,
    handleTitleCaseBlur,
    selectedCategorySlug,
  };
}
