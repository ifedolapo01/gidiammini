/** ADMIN layer — grouped products table for the products list page.
 *
 * The rows shown are the page the server returned; the footer counts come from
 * the summary endpoint, because a count derived from what is on screen would
 * report the page rather than the catalogue.
 */
import { Fragment } from 'react';
import { flattenProducts } from '@/lib/commerce/product-flatten';
import { groupFlattenedByProduct } from '@/lib/commerce/group-variants';
import type { Product } from '@/types/product';
import type { AdminProductsSummary } from '@/lib/commerce/admin-products-summary';
import { SelectAllCheckbox } from '@/app/admin/components/SelectionCheckbox';
import type { TableSelection } from '@/app/admin/hooks/useTableSelection';
import { SingleProductRow, GroupedParentRow } from './ProductTableRow';
import { VariantChildRows } from './VariantChildRows';

const HEADINGS = ['Variant', 'Category', 'Price', 'Stock', 'Images', 'Actions'];

interface ProductsTableProps {
  products: Product[];
  selection: TableSelection;
  summary: AdminProductsSummary | null;
  onDelete: (productId: string) => void;
  children?: React.ReactNode;
}

export function ProductsTable({ products, selection, summary, onDelete, children }: ProductsTableProps) {
  const flattened = flattenProducts(products);
  const groupedProducts = groupFlattenedByProduct(flattened);

  return (
    <div className="bg-surface rounded-surface border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-background-secondary">
            <tr>
              <th scope="col" className="px-4 py-3 w-10">
                <SelectAllCheckbox
                  checked={selection.allVisibleSelected}
                  indeterminate={selection.someVisibleSelected}
                  onChange={selection.toggleAll}
                  disabled={products.length === 0}
                />
              </th>
              <th scope="col" className="px-6 py-3 text-left pl-16 text-caption-md font-medium text-text-secondary uppercase tracking-wider">
                Product
              </th>
              {HEADINGS.map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="px-6 py-3 text-center text-caption-md font-medium text-text-secondary uppercase tracking-wider"
                >
                  {heading}
                </th>
              ))}
            </tr>
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
