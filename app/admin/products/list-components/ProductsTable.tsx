/** ADMIN layer — grouped products table for the products list page. */
import { Fragment } from 'react';
import { flattenProducts } from '@/lib/commerce/product-flatten';
import { groupFlattenedByProduct } from '@/lib/commerce/group-variants';
import type { Product } from '@/types/product';
import { SingleProductRow, GroupedParentRow } from './ProductTableRow';
import { VariantChildRows } from './VariantChildRows';

interface ProductsTableProps {
  products: Product[];
  onDelete: (productId: string) => void;
}

export function ProductsTable({ products, onDelete }: ProductsTableProps) {
  const flattened = flattenProducts(products);
  const groupedProducts = groupFlattenedByProduct(flattened);

  return (
    <div className="bg-surface rounded-surface border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-background-secondary">
            <tr>
              <th className="px-6 py-3 text-left pl-16 text-caption-md font-medium text-text-secondary uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-center text-caption-md font-medium text-text-secondary uppercase tracking-wider">Variant</th>
              <th className="px-6 py-3 text-center text-caption-md font-medium text-text-secondary uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-center text-caption-md font-medium text-text-secondary uppercase tracking-wider">Price</th>
              <th className="px-6 py-3 text-center text-caption-md font-medium text-text-secondary uppercase tracking-wider">Stock</th>
              <th className="px-6 py-3 text-center text-caption-md font-medium text-text-secondary uppercase tracking-wider">Images</th>
              <th className="px-6 py-3 text-center text-caption-md font-medium text-text-secondary uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider bg-surface">
            {Object.entries(groupedProducts).map(([productId, variants]) => {
              if (variants.length === 1 && variants[0].variantKey === 'single') {
                return <SingleProductRow key={variants[0].id} product={variants[0]} onDelete={onDelete} />;
              }

              const parent = variants[0];
              return (
                <Fragment key={productId}>
                  <GroupedParentRow parent={parent} variantsCount={variants.length} onDelete={onDelete} />
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
            Showing <span className="font-medium">{flattened.length}</span> item{flattened.length !== 1 ? 's' : ''}
          </p>
          <p className="text-body-sm text-text-secondary">
            {flattened.filter(p => p.stock === 0).length} out of stock
          </p>
        </div>
      </div>
    </div>
  );
}
