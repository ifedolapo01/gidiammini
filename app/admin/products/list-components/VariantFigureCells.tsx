/**
 * ADMIN layer — the price / stock / images run shared by all three variant row
 * shapes in the products table.
 *
 * Split out to keep VariantChildRows under the size limit. Padding and
 * alignment come from the shared cell helpers, so these line up with the
 * parent rows and the header above them.
 */
import { Image as ImageIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/commerce/pricing';
import { StockBadge } from '@/components/commerce/StockBadge';
import type { FlattenedProduct } from '@/lib/commerce/product-flatten';
import type { ColumnVisibility } from '@/app/admin/hooks/useColumnVisibility';
import { actionsCell, numericCell, type TableDensity } from '@/app/admin/components/table';

function variantImageCount(product: FlattenedProduct & { extractedColor?: string }) {
  return product.extractedColor
    ? (product.colorImages?.[product.extractedColor] ? 1 : 0)
    : (product.colorImages?.[product.variantKey] ? 1 : 0);
}

/** The price / stock / images run, identical on all three variant row shapes. */
export function VariantFigureCells({
  product,
  isVisible,
  density,
}: {
  product: FlattenedProduct & { extractedColor?: string };
  isVisible: ColumnVisibility;
  density: TableDensity;
}) {
  return (
    <>
      {isVisible('price') && (
        <td className={numericCell(density, 'whitespace-nowrap text-body-sm font-medium text-text-primary')}>
          {formatCurrency(product.price)}
        </td>
      )}
      {isVisible('stock') && (
        <td className={numericCell(density, 'whitespace-nowrap text-body-sm')}>
          <StockBadge stock={product.stock} hideWhenInStock={false} countFormat="units" className="font-bold" />
        </td>
      )}
      {isVisible('images') && (
        <td className={numericCell(density, 'whitespace-nowrap text-body-sm')}>
          <span className="inline-flex items-center justify-end gap-1">
            <ImageIcon size={16} className="text-text-muted" aria-hidden="true" />
            <span className="text-text-secondary">{variantImageCount(product)}</span>
          </span>
        </td>
      )}
      {/* The actions column, which a variant row has none of. Never hideable,
          so it is always present. */}
      <td className={actionsCell(density)}></td>
    </>
  );
}

