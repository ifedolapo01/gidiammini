/** ADMIN layer — "Features & Details" bullet-point list editor for the product form. */
'use client';

import { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormRegister } from 'react-hook-form';
import { X } from 'lucide-react';
import { Input } from '@/components/ui';
import { ProductFormValues } from '@/lib/commerce/product-form-schema';

export interface ProductDetailsEditorProps {
  register: UseFormRegister<ProductFormValues>;
  detailFields: FieldArrayWithId<ProductFormValues, 'details', 'id'>[];
  appendDetail: UseFieldArrayAppend<ProductFormValues, 'details'>;
  removeDetail: UseFieldArrayRemove;
  handleTitleCaseBlur: (fieldPath: any) => void;
}

export function ProductDetailsEditor({
  register,
  detailFields,
  appendDetail,
  removeDetail,
  handleTitleCaseBlur,
}: ProductDetailsEditorProps) {
  return (
    <div className="bg-background-secondary p-5 rounded-surface border border-border-light md:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <div>
          <label className="block text-body-sm font-bold text-text-primary">Features & Details</label>
          <p className="text-caption-md text-text-secondary mt-0.5">These will appear as bullet points on the product page.</p>
        </div>
        <button
          type="button"
          onClick={() => appendDetail({ value: '' })}
          className="text-caption-md font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-control hover:bg-primary/20 transition-colors"
        >
          + Add Detail
        </button>
      </div>
      <div className="space-y-3">
        {detailFields.map((field, index) => (
          <div key={field.id} className="flex gap-2">
            <div className="mt-3 w-1.5 h-1.5 rounded-full bg-text-muted shrink-0" />
            <div className="flex-1">
              <Input
                {...register(`details.${index}.value`, { onBlur: () => handleTitleCaseBlur(`details.${index}.value`) })}
                placeholder="e.g., 100% Organic Cotton"
              />
            </div>
            <button
              type="button"
              onClick={() => removeDetail(index)}
              className="p-2 text-text-muted hover:text-destructive hover:bg-destructive-background rounded-control transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        ))}
        {detailFields.length === 0 && (
          <p className="text-body-sm text-text-muted italic">No features added. Click '+ Add Detail' to include some.</p>
        )}
      </div>
    </div>
  );
}
