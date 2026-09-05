/** ADMIN layer — the pieces the stock table's row renderers share.
 *
 * Extracted so StockRow.tsx (the product-level row) and StockVariantRows.tsx
 * (the grouped parent and its variants) can each stay small, rather than one
 * file holding three renderers and growing past the project's line cap.
 */
import { Package, Edit } from 'lucide-react';
import ProductImage from '@/components/commerce/ProductImage';

export function UpdateStockButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-center">
      <button
        onClick={onClick}
        className="text-primary hover:text-primary-hover flex items-center justify-center bg-surface px-3 py-1.5 rounded-control border border-primary/30 shadow-elevation-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus"
      >
        <Edit className="w-4 h-4 mr-1" />
        Update Stock
      </button>
    </div>
  );
}

/** The product thumbnail, or a placeholder tile when there is no image. */
export function StockThumbnail({
  src,
  alt,
  bordered = false,
}: {
  src?: string;
  alt: string;
  bordered?: boolean;
}) {
  const border = bordered ? ' border border-border-strong' : '';

  if (!src) {
    return (
      <div className={`w-12 h-12 flex-shrink-0 bg-background-tertiary rounded-control flex items-center justify-center${border}`}>
        <Package className="h-5 w-5 text-text-secondary" />
      </div>
    );
  }

  return (
    <ProductImage src={src} alt={alt} className={`w-12 h-12 flex-shrink-0 rounded-control${border}`} sizes="48px" />
  );
}
