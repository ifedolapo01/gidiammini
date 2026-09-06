/** ADMIN layer — the single-variant row of the stock management table.
 *
 * Selection here is per VARIANT, not per product: a stock figure belongs to a
 * variant, so that is what a bulk set has to address. Products with more than
 * one variant render through StockVariantRows.tsx instead.
 */
import { formatCategoryStr } from '@/lib/commerce/format-text';
import { formatCurrency } from '@/lib/commerce/pricing';
import { StockBadge } from '@/components/commerce/StockBadge';
import type { FlattenedProduct } from '@/lib/commerce/product-flatten';
import { RowCheckbox } from '@/app/admin/components/SelectionCheckbox';
import type { VariantInsight } from '@/lib/commerce/inventory-analytics';
import { UpdateStockButton, StockThumbnail } from './StockRowParts';
import { StockCoverHint } from './StockCoverHint';

interface SingleStockRowProps {
  product: FlattenedProduct;
  lowStockThreshold: number;
  /** The ledger's reading for this variant. Absent until the second request
   *  lands, and for rows that predate product_variants. */
  insight?: VariantInsight;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: (product: FlattenedProduct) => void;
}

export function SingleStockRow({
  product,
  lowStockThreshold,
  insight,
  selected,
  onToggleSelect,
  onEdit,
}: SingleStockRowProps) {
  return (
    <tr className={selected ? 'bg-primary/5' : 'hover:bg-surface-hover'}>
      <td className="px-4 py-4 w-10">
        <RowCheckbox checked={selected} onChange={onToggleSelect} rowLabel={product.name} />
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-left pl-16">
        <div className="flex items-center justify-start gap-4">
          <StockThumbnail src={product.main_image} alt={product.name} />
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
        <div className="flex flex-col items-center justify-center">
          <StockBadge
            stock={product.stock}
            lowStockThreshold={lowStockThreshold}
            hideWhenInStock={false}
            countFormat="parens"
            className="px-3 py-1.5 font-bold"
          />
          <StockCoverHint insight={insight} />
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-body-sm font-medium text-center">
        <UpdateStockButton onClick={() => onEdit(product)} />
      </td>
    </tr>
  );
}
