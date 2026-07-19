/** ADMIN layer — cascading product -> size -> color picker for VARIANT-scope discount targeting. */
'use client';

import { Plus } from 'lucide-react';
import { Button, Select } from '@/components/ui';
import type { Product } from '@/types/product';
import type { VariantTarget } from '@/lib/commerce/discount-target';

interface VariantTargetPickerProps {
  products: Product[];
  variantProductId: string;
  setVariantProductId: (id: string) => void;
  variantSize: string;
  setVariantSize: (size: string) => void;
  variantColor: string;
  setVariantColor: (color: string) => void;
  addedVariants: VariantTarget[];
  onAddVariant: () => void;
  onRemoveVariant: (index: number) => void;
}

export function VariantTargetPicker({
  products,
  variantProductId, setVariantProductId,
  variantSize, setVariantSize,
  variantColor, setVariantColor,
  addedVariants, onAddVariant, onRemoveVariant,
}: VariantTargetPickerProps) {
  return (
    <div className="space-y-4 bg-background-secondary p-4 rounded-surface border border-border-light">
      <div className="space-y-3">
        <div>
          <label className="block text-caption-md font-medium text-text-primary mb-1">Select Product</label>
          <Select
            size="sm"
            value={variantProductId}
            onChange={(e) => {
              setVariantProductId(e.target.value);
              setVariantSize('');
              setVariantColor('');
            }}
          >
            <option value="">Choose a product...</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>

        {variantProductId && (() => {
          const selectedProduct = products.find(p => p.id === variantProductId);
          const config = selectedProduct?.pricing_config;

          let availableSizes = selectedProduct?.sizes || [];
          let availableColors = selectedProduct?.colors || [];

          // If it's combination mode and a size is selected, filter colors
          if (config && config.mode === 'combination' && variantSize) {
            const combinationPrices = config.combinationPrices || {};
            availableColors = Object.keys(combinationPrices)
              .filter(key => key.startsWith(`${variantSize}|`))
              .map(key => key.split('|')[1]);
          }

          return (
            <div className="grid grid-cols-2 gap-3">
              {availableSizes.length > 0 && (
                <div>
                  <label className="block text-caption-md font-medium text-text-primary mb-1">Select Size/Age</label>
                  <Select
                    size="sm"
                    value={variantSize}
                    onChange={(e) => setVariantSize(e.target.value)}
                  >
                    <option value="" disabled>Choose size...</option>
                    {availableSizes.map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </Select>
                </div>
              )}

              {availableColors.length > 0 && (
                <div>
                  <label className="block text-caption-md font-medium text-text-primary mb-1">Select Color</label>
                  <Select
                    size="sm"
                    value={variantColor}
                    onChange={(e) => setVariantColor(e.target.value)}
                    disabled={config?.mode === 'combination' && !variantSize}
                  >
                    <option value="" disabled>{config?.mode === 'combination' && !variantSize ? 'Select size first...' : 'Choose color...'}</option>
                    {availableColors.map(color => (
                      <option key={color} value={color}>{color}</option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          );
        })()}

        <div className="flex justify-end pt-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onAddVariant}
            disabled={!variantProductId}
          >
            <Plus size={14} /> Add Variant to Discount
          </Button>
        </div>
      </div>

      {addedVariants.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <label className="block text-caption-md font-semibold text-text-primary mb-2">Targeted Variants ({addedVariants.length})</label>
          <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1">
            {addedVariants.map((v, i) => {
              const p = products.find(prod => prod.id === v.productId);
              return (
                <div key={i} className="flex items-center justify-between bg-surface border border-border p-2 rounded-control shadow-elevation-1">
                  <div className="text-body-sm">
                    <span className="font-medium text-text-primary">{p?.name || 'Unknown Product'}</span>
                    <span className="text-text-secondary ml-2">
                      {v.size && `• ${v.size} `}
                      {v.color && `• ${v.color}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveVariant(i)}
                    className="text-text-muted hover:text-destructive p-1"
                  >
                    &times;
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
