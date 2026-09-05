/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/orders/components/AddOrderLine.tsx
//
// Putting something into an existing order.
//
// Product, then variant, then price — in that order, because the variant is
// what decides the price and offering a price field first invites somebody to
// type the base price for a variant that costs more. The price stays editable
// after that: a swap agreed over WhatsApp at the price the customer already
// paid is a legitimate and common thing, and forcing the catalogue price would
// send them a bill they did not agree to.
'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import { useProductPicker, type PickerProduct } from '../hooks/useProductPicker';
import ProductSearchList from './ProductSearchList';
import type { DraftLine } from '../hooks/useOrderEdit';

interface AddOrderLineProps {
  onAdd: (line: Omit<DraftLine, 'key'>) => void;
}

function variantLabel(size: string | null, color: string | null): string {
  return [size, color].filter(Boolean).join(' / ') || 'Standard';
}

export default function AddOrderLine({ onAdd }: AddOrderLineProps) {
  const picker = useProductPicker();
  const [product, setProduct] = useState<PickerProduct | null>(null);
  const [variantKey, setVariantKey] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');

  const variants = product ? picker.variantsFor(product.id) : [];
  const variant = variants.find((option) => option.variant_key === variantKey) ?? null;

  const choose = (chosen: PickerProduct) => {
    setProduct(chosen);
    const options = picker.variantsFor(chosen.id);
    // One variant is not a choice — pre-select it and let the price fill in.
    const only = options.length === 1 ? options[0] : null;
    setVariantKey(only?.variant_key ?? '');
    setPrice(String(only?.price ?? chosen.price));
    setQuantity('1');
  };

  const chooseVariant = (key: string) => {
    setVariantKey(key);
    const chosen = variants.find((option) => option.variant_key === key);
    if (chosen) setPrice(String(chosen.price ?? product?.price ?? 0));
  };

  const numericPrice = Number(price);
  const numericQuantity = Number(quantity);
  const ready =
    product !== null &&
    (variants.length === 0 || variant !== null) &&
    Number.isFinite(numericPrice) && numericPrice >= 0 &&
    Number.isInteger(numericQuantity) && numericQuantity >= 1;

  const add = () => {
    if (!product || !ready) return;

    onAdd({
      product_id: product.id,
      product_name: product.name,
      price: Math.round(numericPrice),
      quantity: numericQuantity,
      size: variant?.size ?? null,
      color: variant?.color ?? null,
    });

    setProduct(null);
    setVariantKey('');
    setPrice('');
    setQuantity('1');
    picker.setSearch('');
  };

  if (picker.error) {
    return (
      <p className="rounded-surface border border-destructive-border bg-destructive-background p-3 text-body-sm text-destructive">
        {picker.error}
      </p>
    );
  }

  return (
    <div className="rounded-surface border border-dashed border-border-strong p-3">
      <p className="mb-2 text-body-sm font-medium text-text-primary">Add an item</p>

      {!product ? (
        <ProductSearchList
          search={picker.search}
          onSearchChange={picker.setSearch}
          results={picker.results}
          loading={picker.loading}
          onPick={choose}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-body-sm font-medium text-text-primary">{product.name}</p>
            <Button size="sm" variant="ghost" onClick={() => setProduct(null)}>
              Change
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {variants.length > 0 && (
              <div className="sm:col-span-3">
                <label htmlFor="add-variant" className="mb-1 block text-caption-md text-text-secondary">
                  Variant
                </label>
                <Select
                  id="add-variant"
                  value={variantKey}
                  onChange={(event) => chooseVariant(event.target.value)}
                >
                  <option value="">Choose…</option>
                  {variants.map((option) => (
                    <option key={option.variant_key} value={option.variant_key}>
                      {variantLabel(option.size, option.color)}
                      {option.price != null ? ` — ${formatCurrency(option.price)}` : ''}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="sm:col-span-2">
              <label htmlFor="add-price" className="mb-1 block text-caption-md text-text-secondary">
                Unit price (₦)
              </label>
              <Input
                id="add-price"
                type="number"
                min={0}
                step={1}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </div>

            <div>
              <label htmlFor="add-quantity" className="mb-1 block text-caption-md text-text-secondary">
                Quantity
              </label>
              <Input
                id="add-quantity"
                type="number"
                min={1}
                max={999}
                step={1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
          </div>

          <Button size="sm" onClick={add} disabled={!ready}>
            <Plus className="size-4" aria-hidden="true" />
            Add to order
          </Button>
        </div>
      )}
    </div>
  );
}
