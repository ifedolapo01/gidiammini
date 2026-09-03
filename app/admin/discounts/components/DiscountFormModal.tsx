/** ADMIN layer — create/edit discount modal form. */
'use client';

import { Dispatch, SetStateAction } from 'react';
import { Button, Input, Modal, Select, Checkbox } from '@/components/ui';
import type { Category, Product } from '@/types/product';
import type { VariantTarget } from '@/lib/commerce/discount-target';
import type { DiscountFormData } from '../hooks/useDiscounts';
import { DiscountTargetField } from './DiscountTargetField';
import MarginFloorWarning from './MarginFloorWarning';

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

interface DiscountFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingId: string | null;
  formData: DiscountFormData;
  setFormData: Dispatch<SetStateAction<DiscountFormData>>;
  categories: Category[];
  products: Product[];
  error: string;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  variantTargeting: VariantTargetingProps;
}

export function DiscountFormModal({
  isOpen, onClose, editingId, formData, setFormData,
  categories, products, error, isSubmitting, onSubmit,
  variantTargeting,
}: DiscountFormModalProps) {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="lg"
      scrollable
      padded={false}
      title={editingId ? 'Edit Discount' : 'Create New Discount'}
      headerClassName="border-b border-border-light bg-background-secondary/50"
    >
      <form onSubmit={onSubmit} className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-destructive-background text-destructive text-body-sm rounded-control border border-destructive-border">
            {error}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label className="block text-body-sm font-semibold text-text-primary mb-1.5">Discount Name</label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. Summer Sale 2024"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-body-sm font-semibold text-text-primary mb-1.5">Discount Type</label>
              <Select
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value as any})}
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (₦)</option>
              </Select>
            </div>
            <div>
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
                  required
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
              onTargetIdChange={(value) => setFormData({...formData, target_id: value})}
              categories={categories}
              products={products}
              variantTargeting={variantTargeting}
            />
          </div>

          <MarginFloorWarning
            products={products}
            discount={{
              type: formData.type,
              value: Number(formData.value) || 0,
              scope: formData.scope,
              target_id: formData.target_id || null,
            }}
          />

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border-light">
            <div>
              <label className="block text-body-sm font-semibold text-text-primary mb-1.5">Start Date <span className="font-normal text-text-muted text-caption-md">(Optional)</span></label>
              <input
                type="datetime-local"
                value={formData.start_date}
                onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                className="w-full rounded-control border border-border bg-surface px-3 py-2 text-text-primary"
              />
            </div>
            <div>
              <label className="block text-body-sm font-semibold text-text-primary mb-1.5">End Date <span className="font-normal text-text-muted text-caption-md">(Optional)</span></label>
              <input
                type="datetime-local"
                value={formData.end_date}
                onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                className="w-full rounded-control border border-border bg-surface px-3 py-2 text-text-primary"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
            />
            <label htmlFor="is_active" className="text-body-sm font-medium text-text-primary">Active (Apply this discount immediately)</label>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={isSubmitting || !formData.name || !formData.value}
          >
            {editingId ? 'Save Changes' : 'Create Discount'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
