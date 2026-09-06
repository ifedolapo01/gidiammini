/** ADMIN layer — "Low Stock" card on the dashboard. */
import Link from 'next/link';
import { Package } from 'lucide-react';
import { getStockStatus } from '@/lib/commerce/stock';
import ProductImage from '@/components/commerce/ProductImage';

interface LowStockPanelProps {
  products: any[];
  /** The threshold the dashboard route filtered on. Passed in rather than
   *  re-derived, so the heading cannot describe a different query from the one
   *  that produced these rows. */
  lowStockThreshold: number;
}

export function LowStockPanel({ products, lowStockThreshold }: LowStockPanelProps) {
  return (
    <div className="bg-surface p-6 rounded-surface shadow-elevation-1 border border-border">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-h5 font-bold text-text-primary">Low Stock</h2>
          <p className="text-caption-md text-text-secondary">
            {lowStockThreshold} or fewer left
          </p>
        </div>
        <Link
          href="/admin/stock"
          className="text-primary hover:text-primary-hover text-body-sm font-medium"
        >
          View all
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-8">
          <Package className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary">All products have sufficient stock</p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((product) => {
            const status = getStockStatus(product.stock, lowStockThreshold);
            const isCritical = status.level === 'low' || status.level === 'out';

            return (
              <div
                key={product.id}
                className="flex items-center p-3 hover:bg-destructive-background rounded-control"
              >
                <ProductImage
                  src={product.main_image}
                  alt={product.name}
                  className="w-12 h-12 rounded-control mr-4 flex-shrink-0"
                  sizes="48px"
                />
                <div className="flex-1">
                  <p className="font-medium text-text-primary">{product.name}</p>
                  <p className="text-body-sm text-text-secondary">{product.category}</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${isCritical ? 'text-destructive' : 'text-warning'}`}>
                    {product.stock} left
                  </p>
                  <p className="text-caption-md text-text-secondary">Stock alert</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
