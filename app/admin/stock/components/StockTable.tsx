/** ADMIN layer — grouped stock table for the stock management page.
 *
 * Rows are the page the server returned. Selection addresses variants
 * ("productId:variantKey") because that is what a stock figure belongs to;
 * see lib/commerce/product-flatten.ts#variantRef.
 *
 * Product and stock sort on the server through the same query the products
 * list uses. The stock column stays centred rather than right-aligned because
 * what sits in it is a badge and a cover hint, not a bare figure — the digits
 * inside it are tabular (see StockBadge), which is the part that makes a
 * column of them comparable.
 */
'use client';

import { Fragment } from 'react';
import { Package, Plus } from 'lucide-react';
import { groupFlattenedByProduct } from '@/lib/commerce/group-variants';
import { variantRef, type FlattenedProduct } from '@/lib/commerce/product-flatten';
import { SelectAllCheckbox } from '@/app/admin/components/SelectionCheckbox';
import type { TableSelection } from '@/app/admin/hooks/useTableSelection';
import type { VariantInsight } from '@/lib/commerce/inventory-analytics';
import { SingleStockRow } from './StockRow';
import { ParentStockRow, ChildStockRow } from './StockVariantRows';
import { SortableHeaderRow, STICKY_HEAD, TABLE_SCROLL, TH, type TableColumn, type TableDensity } from '@/app/admin/components/table';
import type { SortDirection } from '@/app/admin/hooks/useListParams';

const COLUMNS: TableColumn[] = [
  { key: 'name', label: 'Product', sortable: true, className: 'pl-16' },
  { key: 'variant', label: 'Variant', className: 'text-center' },
  { key: 'category', label: 'Category', className: 'text-center' },
  { key: 'stock', label: 'Stock status', sortable: true, className: 'text-center' },
  { key: 'actions', label: 'Actions', srOnlyLabel: true, className: 'text-center' },
];

interface StockTableProps {
  products: FlattenedProduct[];
  lowStockThreshold: number;
  sort: string;
  direction: SortDirection;
  onSortChange: (sort: string, direction: SortDirection) => void;
  density: TableDensity;
  /** The ledger's reading per variant id, empty until the second request
   *  lands. Passed down the same path lowStockThreshold already takes. */
  insights: Map<string, VariantInsight>;
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
  sort,
  direction,
  onSortChange,
  density,
  insights,
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
        <div className={TABLE_SCROLL} tabIndex={0} role="region" aria-label="Stock table">
          <table className="min-w-full divide-y divide-divider">
            <thead className={STICKY_HEAD}>
              <SortableHeaderRow
                columns={COLUMNS}
                sort={sort}
                direction={direction}
                onSortChange={onSortChange}
                leading={
                  <th scope="col" className={`${TH} w-10`}>
                    <SelectAllCheckbox
                      checked={selection.allVisibleSelected}
                      indeterminate={selection.someVisibleSelected}
                      onChange={selection.toggleAll}
                    />
                  </th>
                }
              />
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
                      insight={variants[0].variantId ? insights.get(variants[0].variantId) : undefined}
                      selected={selection.isSelected(ref)}
                      onToggleSelect={() => selection.toggle(ref)}
                      onEdit={onEdit}
                      density={density}
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
                          insight={product.variantId ? insights.get(product.variantId) : undefined}
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
