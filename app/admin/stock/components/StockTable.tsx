/** ADMIN layer — grouped stock table for the stock management page. */
import { Fragment } from 'react';
import { Package, Plus } from 'lucide-react';
import { groupFlattenedByProduct } from '@/lib/commerce/group-variants';
import type { FlattenedProduct } from '@/lib/commerce/product-flatten';
import { SingleStockRow, ParentStockRow, ChildStockRow } from './StockRow';

interface StockTableProps {
  products: FlattenedProduct[];
  lowStockThreshold: number;
  onEdit: (product: FlattenedProduct) => void;
}

export function StockTable({ products, lowStockThreshold, onEdit }: StockTableProps) {
  return (
    <div className="bg-surface rounded-surface shadow-elevation-1 border border-border overflow-hidden">
      {products.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-background-tertiary text-text-muted rounded-full flex items-center justify-center mb-4">
            <Package size={32} />
          </div>
          <h3 className="text-body-lg font-bold text-text-primary mb-1">No products found</h3>
          <p className="text-text-secondary max-w-md mx-auto mb-6">
            You haven't added any products to your store yet. Add some products to start managing their stock.
          </p>
          <a
            href="/admin/products/new"
            className="bg-primary text-primary-foreground px-4 py-2 rounded-control hover:bg-primary-hover flex items-center gap-2 font-medium transition-colors shadow-elevation-1"
          >
            <Plus size={18} />
            Add Your First Product
          </a>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-divider">
            <thead className="bg-background-secondary">
              <tr>
                <th className="px-6 py-3 text-left pl-16 text-caption-md font-medium text-text-secondary uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-center text-caption-md font-medium text-text-secondary uppercase tracking-wider">
                  Variant
                </th>
                <th className="px-6 py-3 text-center text-caption-md font-medium text-text-secondary uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-center text-caption-md font-medium text-text-secondary uppercase tracking-wider">
                  Stock Status
                </th>
                <th className="px-6 py-3 text-center text-caption-md font-medium text-text-secondary uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-divider">
              {Object.entries(groupFlattenedByProduct(products)).map(([productId, variants]) => {
                if (variants.length === 1 && variants[0].variantKey === 'single') {
                  return (
                    <SingleStockRow
                      key={variants[0].id}
                      product={variants[0]}
                      lowStockThreshold={lowStockThreshold}
                      onEdit={onEdit}
                    />
                  );
                }

                const parent = variants[0];
                return (
                  <Fragment key={productId}>
                    <ParentStockRow parent={parent} variantsCount={variants.length} />
                    {variants.map(product => (
                      <ChildStockRow
                        key={product.id}
                        product={product}
                        lowStockThreshold={lowStockThreshold}
                        onEdit={onEdit}
                      />
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
