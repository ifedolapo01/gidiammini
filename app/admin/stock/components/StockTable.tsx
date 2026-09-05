/** ADMIN layer — grouped stock table for the stock management page.
 *
 * Rows are the page the server returned. Selection addresses variants
 * ("productId:variantKey") because that is what a stock figure belongs to;
 * see lib/commerce/product-flatten.ts#variantRef.
 */
import { Fragment } from 'react';
import { Package, Plus } from 'lucide-react';
import { groupFlattenedByProduct } from '@/lib/commerce/group-variants';
import { variantRef, type FlattenedProduct } from '@/lib/commerce/product-flatten';
import { SelectAllCheckbox } from '@/app/admin/components/SelectionCheckbox';
import type { TableSelection } from '@/app/admin/hooks/useTableSelection';
import { SingleStockRow } from './StockRow';
import { ParentStockRow, ChildStockRow } from './StockVariantRows';

const HEADINGS = ['Product', 'Variant', 'Category', 'Stock Status', 'Actions'];

interface StockTableProps {
  products: FlattenedProduct[];
  lowStockThreshold: number;
  selection: TableSelection;
  onEdit: (product: FlattenedProduct) => void;
  filtered: boolean;
  children?: React.ReactNode;
}

function EmptyStock({ filtered }: { filtered: boolean }) {
  return (
    <div className="p-12 text-center flex flex-col items-center">
      <div className="w-16 h-16 bg-background-tertiary text-text-muted rounded-full flex items-center justify-center mb-4">
        <Package size={32} />
      </div>
      <h3 className="text-body-lg font-bold text-text-primary mb-1">No products found</h3>
      <p className="text-text-secondary max-w-md mx-auto mb-6">
        {filtered
          ? 'Nothing matches these filters. Try a different search or stock level.'
          : "You haven't added any products to your store yet. Add some products to start managing their stock."}
      </p>
      {!filtered && (
        <a
          href="/admin/products/new"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-control hover:bg-primary-hover flex items-center gap-2 font-medium transition-colors shadow-elevation-1"
        >
          <Plus size={18} />
          Add Your First Product
        </a>
      )}
    </div>
  );
}

export function StockTable({
  products,
  lowStockThreshold,
  selection,
  onEdit,
  filtered,
  children,
}: StockTableProps) {
  return (
    <div className="bg-surface rounded-surface shadow-elevation-1 border border-border overflow-hidden">
      {products.length === 0 ? (
        <EmptyStock filtered={filtered} />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-divider">
            <thead className="bg-background-secondary">
              <tr>
                <th scope="col" className="px-4 py-3 w-10">
                  <SelectAllCheckbox
                    checked={selection.allVisibleSelected}
                    indeterminate={selection.someVisibleSelected}
                    onChange={selection.toggleAll}
                  />
                </th>
                {HEADINGS.map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className={`px-6 py-3 text-caption-md font-medium text-text-secondary uppercase tracking-wider ${
                      heading === 'Product' ? 'text-left pl-16' : 'text-center'
                    }`}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-divider">
              {Object.entries(groupFlattenedByProduct(products)).map(([productId, variants]) => {
                // One variant means one row. Previously this also checked for the
                // 'single' key; a lone variant that records a size or colour now
                // keys on those instead, and still needs no expansion.
                if (variants.length === 1) {
                  const ref = variantRef(variants[0]);
                  return (
                    <SingleStockRow
                      key={variants[0].id}
                      product={variants[0]}
                      lowStockThreshold={lowStockThreshold}
                      selected={selection.isSelected(ref)}
                      onToggleSelect={() => selection.toggle(ref)}
                      onEdit={onEdit}
                    />
                  );
                }

                const refs = variants.map(variantRef);
                const selectedCount = refs.filter(selection.isSelected).length;

                return (
                  <Fragment key={productId}>
                    <ParentStockRow
                      parent={variants[0]}
                      variantsCount={variants.length}
                      allSelected={selectedCount === refs.length}
                      someSelected={selectedCount > 0 && selectedCount < refs.length}
                      onToggleGroup={() => selection.setMany(refs, selectedCount !== refs.length)}
                    />
                    {variants.map((product) => {
                      const ref = variantRef(product);
                      return (
                        <ChildStockRow
                          key={product.id}
                          product={product}
                          lowStockThreshold={lowStockThreshold}
                          selected={selection.isSelected(ref)}
                          onToggleSelect={() => selection.toggle(ref)}
                          onEdit={onEdit}
                        />
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {children}
    </div>
  );
}
