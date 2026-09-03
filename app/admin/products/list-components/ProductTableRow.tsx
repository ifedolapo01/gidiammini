/** ADMIN layer — single-row and grouped-parent-row renderers for the products list table. */
import { Edit, Trash2, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui';
import { formatCategoryStr } from '@/lib/commerce/format-text';
import { formatCurrency } from '@/lib/commerce/pricing';
import { StockBadge } from '@/components/commerce/StockBadge';
import type { FlattenedProduct } from '@/lib/commerce/product-flatten';
import ProductImage from '@/components/commerce/ProductImage';

interface RowActionsProps {
  productId: string;
  onDelete: (productId: string) => void;
}

function RowActions({ productId, onDelete }: RowActionsProps) {
  return (
    <div className="flex justify-center gap-2">
      <Link
        href={`/admin/products/edit/${productId}`}
        className="text-primary hover:text-primary-hover transition-colors p-1 hover:bg-primary/10 rounded-control"
        title="Edit product"
      >
        <Edit size={18} />
      </Link>
      <button
        onClick={() => onDelete(productId)}
        className="text-destructive transition-colors p-1 hover:bg-destructive-background rounded-control"
        title="Delete product"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}

interface SingleProductRowProps {
  product: FlattenedProduct;
  onDelete: (productId: string) => void;
}

export function SingleProductRow({ product, onDelete }: SingleProductRowProps) {
  return (
    <tr className="hover:bg-surface-hover transition-colors">
      <td className="px-6 py-4 whitespace-nowrap text-left pl-16">
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
        <Badge tone="primary" className="font-semibold capitalize">
          {formatCategoryStr(product.category, product.sub_category)}
        </Badge>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-body-sm text-text-primary text-center">
        {formatCurrency(product.price)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-body-sm text-center">
        <StockBadge stock={product.stock} hideWhenInStock={false} countFormat="units" className="font-semibold" />
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-body-sm text-center">
        <div className="flex items-center justify-center gap-1">
          <ImageIcon size={16} className="text-text-muted" />
          <span className="text-text-secondary">{1 + (product.images?.length || 0)}</span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-body-sm font-medium text-center">
        <RowActions productId={product.productId} onDelete={onDelete} />
      </td>
    </tr>
  );
}

interface GroupedParentRowProps {
  parent: FlattenedProduct;
  variantsCount: number;
  onDelete: (productId: string) => void;
}

export function GroupedParentRow({ parent, variantsCount, onDelete }: GroupedParentRowProps) {
  return (
    <tr className="bg-background-secondary border-t-2 border-border">
      <td className="px-6 py-3 whitespace-nowrap text-left pl-16">
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
      <td className="px-6 py-3 whitespace-nowrap text-center"></td>
      <td className="px-6 py-3 whitespace-nowrap text-center">
        <Badge tone="primary" className="font-semibold">
          {formatCategoryStr(parent.category, parent.sub_category)}
        </Badge>
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-center"></td>
      <td className="px-6 py-3 whitespace-nowrap text-center"></td>
      <td className="px-6 py-3 whitespace-nowrap text-center"></td>
      <td className="px-6 py-3 whitespace-nowrap text-body-sm font-medium text-center">
        <RowActions productId={parent.productId} onDelete={onDelete} />
      </td>
    </tr>
  );
}
