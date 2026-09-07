/** ADMIN layer — single-row and grouped-parent-row renderers for the products list table. */
'use client';

import { Image as ImageIcon } from 'lucide-react';
import { Badge } from '@/components/ui';
import { formatCategoryStr } from '@/lib/commerce/format-text';
import { formatCurrency } from '@/lib/commerce/pricing';
import { StockBadge } from '@/components/commerce/StockBadge';
import type { FlattenedProduct } from '@/lib/commerce/product-flatten';
import ProductImage from '@/components/commerce/ProductImage';
import { ROW_HOVER, actionsCell, cell, numericCell, type TableDensity } from '@/app/admin/components/table';
import type { ColumnVisibility } from '@/app/admin/hooks/useColumnVisibility';
import { SelectionCell, RowActions } from './ProductRowParts';

interface SingleProductRowProps {
  product: FlattenedProduct;
  selected: boolean;
  onToggleSelect: (productId: string) => void;
  onDelete: (productId: string) => void;
  density: TableDensity;
  isVisible: ColumnVisibility;
}

export function SingleProductRow({
  product,
  selected,
  onToggleSelect,
  onDelete,
  density,
  isVisible,
}: SingleProductRowProps) {
  return (
    <tr className={selected ? 'bg-primary/5 transition-colors' : ROW_HOVER}>
      <SelectionCell
        productId={product.productId}
        name={product.name}
        selected={selected}
        onToggleSelect={onToggleSelect}
        padded={cell(density)}
      />
      <td className={cell(density, 'whitespace-nowrap text-left pl-16')}>
        <div className="flex items-center justify-start">
          <ProductImage
            src={product.main_image}
            alt={product.name}
            className="w-12 h-12 flex-shrink-0 rounded-control"
            sizes="48px"
          />
          <div className="ml-4 text-left">
            <div className="text-body-sm font-bold text-text-primary">{product.name}</div>
          </div>
        </div>
      </td>
      {isVisible('variant') && (
        <td className={cell(density, 'whitespace-nowrap')}>
          {product.variantLabel && product.variantLabel !== 'Standard' ? (
            <span className="px-3 py-1 text-caption-md rounded-full bg-accent/10 text-accent font-bold border border-accent/30">
              {product.variantLabel}
            </span>
          ) : (
            <span className="text-text-muted text-body-sm italic">No variants</span>
          )}
        </td>
      )}
      {isVisible('category') && (
        <td className={cell(density, 'whitespace-nowrap')}>
          <Badge tone="primary" className="font-semibold capitalize">
            {formatCategoryStr(product.category, product.sub_category)}
          </Badge>
        </td>
      )}
      {/* Right-aligned and tabular: a column of prices in proportional digits
          cannot be compared by shape, only by reading each one. */}
      {isVisible('price') && (
        <td className={numericCell(density, 'whitespace-nowrap text-body-sm text-text-primary')}>
          {formatCurrency(product.price)}
        </td>
      )}
      {isVisible('stock') && (
        <td className={numericCell(density, 'whitespace-nowrap text-body-sm')}>
          <StockBadge stock={product.stock} hideWhenInStock={false} countFormat="units" className="font-semibold" />
        </td>
      )}
      {isVisible('images') && (
        <td className={numericCell(density, 'whitespace-nowrap text-body-sm')}>
          <span className="inline-flex items-center justify-end gap-1">
            <ImageIcon size={16} className="text-text-muted" aria-hidden="true" />
            <span className="text-text-secondary">{1 + (product.images?.length || 0)}</span>
          </span>
        </td>
      )}
      <td className={actionsCell(density, 'whitespace-nowrap text-body-sm font-medium')}>
        <RowActions productId={product.productId} productName={product.name} onDelete={onDelete} />
      </td>
    </tr>
  );
}

interface GroupedParentRowProps {
  parent: FlattenedProduct;
  variantsCount: number;
  selected: boolean;
  onToggleSelect: (productId: string) => void;
  onDelete: (productId: string) => void;
  density: TableDensity;
  isVisible: ColumnVisibility;
}

export function GroupedParentRow({
  parent,
  variantsCount,
  selected,
  onToggleSelect,
  onDelete,
  density,
  isVisible,
}: GroupedParentRowProps) {
  return (
    <tr className={`border-t-2 border-border ${selected ? 'bg-primary/5' : 'bg-background-secondary'}`}>
      <SelectionCell
        productId={parent.productId}
        name={parent.name}
        selected={selected}
        onToggleSelect={onToggleSelect}
        padded={cell(density)}
      />
      <td className={cell(density, 'whitespace-nowrap text-left pl-16')}>
        <div className="flex items-center justify-start">
          <ProductImage
            src={parent.main_image}
            alt={parent.name}
            className="w-12 h-12 flex-shrink-0 rounded-control border border-border-strong"
            sizes="48px"
          />
          <div className="ml-4 text-left">
            <div className="text-body-sm font-bold text-text-primary">{parent.name}</div>
            <div className="text-caption-md text-text-secondary">{variantsCount} variations</div>
          </div>
        </div>
      </td>
      {isVisible('variant') && <td className={cell(density)}></td>}
      {isVisible('category') && (
        <td className={cell(density, 'whitespace-nowrap')}>
          <Badge tone="primary" className="font-semibold">
            {formatCategoryStr(parent.category, parent.sub_category)}
          </Badge>
        </td>
      )}
      {/* Price and stock are per-variant on a grouped product, so the parent
          row leaves them empty rather than inventing an aggregate. */}
      {isVisible('price') && <td className={cell(density)}></td>}
      {isVisible('stock') && <td className={cell(density)}></td>}
      {isVisible('images') && <td className={cell(density)}></td>}
      <td className={actionsCell(density, 'whitespace-nowrap text-body-sm font-medium')}>
        <RowActions productId={parent.productId} productName={parent.name} onDelete={onDelete} />
      </td>
    </tr>
  );
}
