/**
 * COMMERCE layer — shared zod schema for the admin product create/edit form.
 * Used by both `app/admin/products/new` and `app/admin/products/edit/[id]`.
 */
import { z } from 'zod';
import type { SizingType } from './size-guide';

/** Re-exported so the form's components can name the type without reaching
 *  past the schema they are built from. */
export type { SizingType };

export const productFormSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional().default(''),
  price: z.coerce.number().min(0, 'Price must be a positive number'),
  category: z.string().min(1, 'Category is required'),
  sub_category: z.string().optional(),
  singleSize: z.string().optional(),
  singleColor: z.string().optional(),
  stock: z.coerce.number().min(0, 'Stock must be a positive number'),
  /** Optional. An empty field means "not recorded", which is different from
   * zero — a zero cost would report the whole sale price as profit. */
  cost: z.union([z.coerce.number().min(0, 'Cost cannot be negative'), z.literal('')]).optional(),
  colors: z.array(z.object({ value: z.string() })).optional().default([]),
  sizes: z.array(z.object({ value: z.string() })).optional().default([]),
  /** 'maternity' picks the body-measurement chart in the size guide; the
   *  other two pick the letter and age charts. */
  sizing_type: z.enum(['size', 'age', 'maternity']).optional().default('size'),
  details: z.array(z.object({ value: z.string().min(1, 'Detail cannot be empty') })).optional().default([]),
  /** How the garment runs. '' is "not recorded", which is different from
   *  'true_to_size' — one says nothing, the other is a claim. */
  fit_rating: z.enum(['', 'runs_small', 'true_to_size', 'runs_large']).optional().default(''),
  fit_note: z.string().max(300, 'Keep the fit note under 300 characters').optional().default(''),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export const productFormDefaultValues: ProductFormValues = {
  name: '',
  description: '',
  price: 0,
  category: '',
  sub_category: '',
  singleSize: '',
  singleColor: '',
  stock: 0,
  cost: '',
  colors: [{ value: '' }],
  sizes: [{ value: '' }],
  sizing_type: 'size',
  details: [{ value: '' }],
  fit_rating: '',
  fit_note: '',
};
