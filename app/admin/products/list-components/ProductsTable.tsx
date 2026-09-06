/** ADMIN layer — grouped products table for the products list page.
 *
 * The rows shown are the page the server returned; the footer counts come from
 * the summary endpoint, because a count derived from what is on screen would
 * report the page rather than the catalogue.
 *
 * Name, price and stock sort on the server — the query has accepted those
 * three since it was written (ADMIN_PRODUCT_SORTABLE), and the headings simply
 * never offered them. Category is not among them and is therefore not
 * presented as a control.
 */
'use client';

import { Fragment } from 'react';
import { flattenProducts } from '@/lib/commerce/product-flatten';
import { groupFlattenedByProduct } from '@/lib/commerce/group-variants';
import type { Product } from '@/types/product';
import type { AdminProductsSummary } from '@/lib/commerce/admin-products-summary';
import { SelectAllCheckbox } from '@/app/admin/components/SelectionCheckbox';
import type { TableSelection } from '@/app/admin/hooks/useTableSelection';
import { SingleProductRow, GroupedParentRow } from './ProductTableRow';
import { VariantChildRows } from './VariantChildRows';
import { SortableHeaderRow, STICKY_HEAD, TABLE_SCROLL, TH, type TableColumn, type TableDensity } from '../../components/table';
import type { SortDirection } from '../../hooks/useListParams';

const COLUMNS: TableColumn[] = [
  { key: 'name', label: 'Product', sortable: true, className: 'pl-16' },
  { key: 'variant', label: 'Variant' },
  { key: 'category', label: 'Category' },
  { key: 'price', label: 'Price', numeric: true, sortable: true },
  { key: 'stock', label: 'Stock', numeric: true, sortable: true },
  { key: 'images', label: 'Images', numeric: true },
  { key: 'actions', label: 'Actions', srOnlyLabel: true },
];

interface ProductsTableProps {
  products: Product[];
  selection: TableSelection;
  summary: AdminProductsSummary | null;
  onDelete: (productId: string) => void;
  sort: string;
  direction: SortDirection;
  onSortChange: (sort: string, direction: SortDirection) => void;
  density: TableDensity;
  children?: React.ReactNode;
}

export function ProductsTable({
  products,
  selection,
  summary,
  onDelete,
  sort,
  direction,
  onSortChange,
  density,
  children,
}: ProductsTableProps) {
  const flattened = flattenProducts(products);
  const groupedProducts = groupFlattenedByProduct(flattened);

  return (
    <div className="bg-surface rounded-surface border border-border overflow-hidden">
      <div className={TABLE_SCROLL} tabIndex={0} role="region" aria-label="Products table">
        <table className="w-full">
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
                    disabled={products.length === 0}
                  />
                </th>
              }
            />
          </thead>
          <tbody className="divide-y divide-divider bg-surface">
            {Object.entries(groupedProducts).map(([productId, variants]) => {
              const selected = selection.isSelected(productId);

              // One variant means one row. Previously this also checked for the
              // 'single' key; a lone variant that records a size or colour now
              // keys on those instead, and still needs no expansion.
              if (variants.length === 1) {
                return (
                  <SingleProductRow
                    key={variants[0].id}
                    product={variants[0]}
                    selected={selected}
                    onToggleSelect={selection.toggle}
                    onDelete={onDelete}
                    density={density}
                  />
                );
              }

              const parent = variants[0];
              return (
                <Fragment key={productId}>
                  <GroupedParentRow
                    parent={parent}
                    variantsCount={variants.length}
                    selected={selected}
                    onToggleSelect={selection.toggle}
                    onDelete={onDelete}
                    density={density}
                  />
                  <VariantChildRows productId={productId} variants={variants} />
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 bg-background-secondary border-t border-border">
        <div className="flex justify-between items-center">
          <p className="text-body-sm text-text-primary">
            Showing <span className="font-medium">{flattened.length}</span> item
            {flattened.length !== 1 ? 's' : ''}
            {summary && <> of {summary.variants} across the catalogue</>}
          </p>
          {summary && (
            <p className="text-body-sm text-text-secondary">{summary.outOfStock} out of stock</p>
          )}
        </div>
      </div>

      {children}
    </div>
  );
}
