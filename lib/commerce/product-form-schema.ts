/**
 * COMMERCE layer — shared zod schema for the admin product create/edit form.
 * Used by both `app/admin/products/new` and `app/admin/products/edit/[id]`.
 */
import { z } from 'zod';

export const productFormSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional().default(''),
  price: z.coerce.number().min(0, 'Price must be a positive number'),
  category: z.string().min(1, 'Category is required'),
  sub_category: z.string().optional(),
  singleSize: z.string().optional(),
  singleColor: z.string().optional(),
  stock: z.coerce.number().min(0, 'Stock must be a positive number'),
  colors: z.array(z.object({ value: z.string() })).optional().default([]),
  sizes: z.array(z.object({ value: z.string() })).optional().default([]),
  sizing_type: z.enum(['size', 'age']).optional().default('size'),
  details: z.array(z.object({ value: z.string().min(1, 'Detail cannot be empty') })).optional().default([]),
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
  colors: [{ value: '' }],
  sizes: [{ value: '' }],
  sizing_type: 'size',
  details: [{ value: '' }],
};
