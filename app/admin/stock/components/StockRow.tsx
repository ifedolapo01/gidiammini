/** ADMIN layer — row renderers for the stock management table. */
import { Package, Edit } from 'lucide-react';
import { formatCategoryStr, capitalizeText } from '@/lib/commerce/format-text';
import { formatCurrency } from '@/lib/commerce/pricing';
import { StockBadge } from '@/components/commerce/StockBadge';
import type { FlattenedProduct } from '@/lib/commerce/product-flatten';
import ProductImage from '@/components/commerce/ProductImage';

function UpdateStockButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-center">
      <button
        onClick={onClick}
        className="text-primary hover:text-primary-hover flex items-center justify-center bg-surface px-3 py-1.5 rounded-control border border-primary/30 shadow-elevation-1 transition-all"
      >
        <Edit className="w-4 h-4 mr-1" />
        Update Stock
      </button>
    </div>
  );
}

interface SingleStockRowProps {
  product: FlattenedProduct;
  lowStockThreshold: number;
  onEdit: (product: FlattenedProduct) => void;
}

export function SingleStockRow({ product, lowStockThreshold, onEdit }: SingleStockRowProps) {
  return (
    <tr className="hover:bg-surface-hover">
      <td className="px-6 py-4 whitespace-nowrap text-left pl-16">
        <div className="flex items-center justify-start gap-4">
          {product.main_image ? (
            <ProductImage
              src={product.main_image}
              alt={product.name}
              className="w-12 h-12 flex-shrink-0 rounded-control"
              sizes="48px"
            />
          ) : (
            <div className="w-12 h-12 flex-shrink-0 bg-background-tertiary rounded-control flex items-center justify-center">
              <Package className="h-5 w-5 text-text-secondary" />
            </div>
          )}
          <div className="text-left">
            <p className="font-bold text-text-primary">{product.name}</p>
            <p className="text-body-sm text-text-secondary">{formatCurrency(product.price)}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center">
        {product.variantLabel && product.variantLabel !== 'Standard' ? (
          <span className="px-3 py-1 text-caption-md rounded-full bg-accent/10 text-accent font-bold border border-accent/30">
            {product.variantLabel}
          </span>
        ) : (
          <span className="text-text-muted text-body-sm italic">No variants</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center">
        <span className="px-2 py-1 text-caption-md rounded-full bg-background-tertiary text-text-primary font-medium capitalize">
          {formatCategoryStr(product.category, product.sub_category)}
        </span>
      </td>
      {/* Centred, matching the STOCK STATUS header and the variant rows below.
          This cell had text-left/pl-16 copied from the product-name cell, which
          pushed a single-variant product's badge out of line with every other
          row in the table. */}
      <td className="px-6 py-4 whitespace-nowrap text-center">
        <div className="flex items-center justify-center">
          <StockBadge
            stock={product.stock}
            lowStockThreshold={lowStockThreshold}
            hideWhenInStock={false}
            countFormat="parens"
            className="px-3 py-1.5 font-bold"
          />
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-body-sm font-medium text-center">
        <UpdateStockButton onClick={() => onEdit(product)} />
      </td>
    </tr>
  );
}

interface ParentStockRowProps {
  parent: FlattenedProduct;
  variantsCount: number;
}

export function ParentStockRow({ parent, variantsCount }: ParentStockRowProps) {
  return (
    <tr className="bg-background-secondary border-t-2 border-border">
      <td className="px-6 py-3 whitespace-nowrap text-left pl-16">
        <div className="flex items-center justify-start gap-4">
          {parent.main_image ? (
            <ProductImage
              src={parent.main_image}
              alt={parent.name}
              className="w-12 h-12 flex-shrink-0 rounded-control border border-border-strong"
              sizes="48px"
            />
          ) : (
            <div className="w-12 h-12 flex-shrink-0 bg-background-tertiary rounded-control flex items-center justify-center border border-border-strong">
              <Package className="h-5 w-5 text-text-secondary" />
            </div>
          )}
          <div className="text-left">
            <p className="font-bold text-text-primary">{parent.name}</p>
            <p className="text-caption-md text-text-secondary">{variantsCount} variations</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-center"></td>
      <td className="px-6 py-3 whitespace-nowrap text-center">
        <span className="px-2 py-1 text-caption-md rounded-full bg-background-tertiary text-text-primary font-medium capitalize">
          {formatCategoryStr(parent.category, parent.sub_category)}
        </span>
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-center"></td>
      <td className="px-6 py-3 whitespace-nowrap text-center"></td>
    </tr>
  );
}

interface ChildStockRowProps {
  product: FlattenedProduct;
  lowStockThreshold: number;
  onEdit: (product: FlattenedProduct) => void;
}

export function ChildStockRow({ product, lowStockThreshold, onEdit }: ChildStockRowProps) {
  let variantDisplay = capitalizeText(product.variantLabel);
  if (product.variantKey.includes('|')) {
    const [size, color] = product.variantKey.split('|');
    variantDisplay = `Size: ${size} • Color: ${capitalizeText(color)}`;
  }

  return (
    <tr className="hover:bg-primary/10 border-l-4 border-primary/40 bg-surface">
      <td className="px-6 py-3 whitespace-nowrap text-center">
        {/* Empty cell for Product column indent */}
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-center">
        <div className="flex flex-col items-center justify-center">
          <span className="px-3 py-1 text-caption-md rounded-full bg-accent/10 text-accent font-bold border border-accent/30 mb-1">
            {variantDisplay}
          </span>
          <span className="text-body-sm text-text-secondary font-medium">{formatCurrency(product.price)}</span>
        </div>
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-center">
        {/* Empty Category column */}
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-center">
        <div className="flex items-center justify-center">
          <StockBadge
            stock={product.stock}
            lowStockThreshold={lowStockThreshold}
            hideWhenInStock={false}
            countFormat="parens"
            className="px-3 py-1.5 font-bold"
          />
        </div>
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-body-sm font-medium text-center">
        <UpdateStockButton onClick={() => onEdit(product)} />
      </td>
    </tr>
  );
}
