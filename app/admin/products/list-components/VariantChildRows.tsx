/** ADMIN layer — child-row renderers (combination / simple variants) for the products list table.
 *
 * Every row starts with an empty cell under the selection column: bulk actions
 * apply to products, not to individual variants, so a variant row has no
 * checkbox of its own but still has to line up with the header.
 *
 * PADDING COMES FROM THE SHARED HELPERS
 *
 * Every cell here goes through cell()/numericCell()/actionsCell(), the same
 * ones the parent rows use. They were hand-written `px-6 py-3` while the parent
 * rows were `px-4` — the columns lined up (a table guarantees that) but the
 * *content* inside them did not, so a variant's colour badge sat two units
 * right of the heading it belonged under. That is what made the table look as
 * though its contents had wandered out of their columns.
 *
 * COLUMN VISIBILITY
 *
 * Each row renders one cell per column, filled or empty, so hiding a column
 * has to remove the matching cell from every row type here as well as from the
 * header — a table whose child rows carry a cell the header no longer has is
 * not misaligned only on that row, it is misaligned from there down. Hence the
 * `isVisible` predicate threaded through all of them, and `visibleColumnCount`
 * for the one row that spans the rest of the table.
 */
import { Fragment } from 'react';
import { Badge } from '@/components/ui';
import { capitalizeText } from '@/lib/commerce/format-text';
import { hasCombination, groupBySize, type SizeGroupedVariant } from '@/lib/commerce/group-variants';
import type { FlattenedProduct } from '@/lib/commerce/product-flatten';
import type { ColumnVisibility } from '@/app/admin/hooks/useColumnVisibility';
import { cell, type TableDensity } from '@/app/admin/components/table';
import { VariantFigureCells } from './VariantFigureCells';

interface RowProps {
  isVisible: ColumnVisibility;
  density: TableDensity;
}

function CombinationSingleRow({ product, isVisible, density }: { product: SizeGroupedVariant } & RowProps) {
  return (
    <tr className="hover:bg-primary/10 transition-colors border-l-[8px] border-primary/60 bg-surface">
      <td className={cell(density, 'w-10')} />
      <td className={cell(density, 'whitespace-nowrap pl-16 text-body-sm font-bold text-text-primary')}>
        Size: {product.extractedSize}
      </td>
      {isVisible('variant') && (
        <td className={cell(density, 'whitespace-nowrap')}>
          <Badge tone="primary" className="font-bold">
            Color: {capitalizeText(product.extractedColor)}
          </Badge>
        </td>
      )}
      {isVisible('category') && <td className={cell(density, 'whitespace-nowrap')}></td>}
      <VariantFigureCells product={product} isVisible={isVisible} density={density} />
    </tr>
  );
}

function CombinationGroupRows({
  size,
  sizeVariants,
  isVisible,
  density,
  visibleColumnCount,
}: { size: string; sizeVariants: SizeGroupedVariant[]; visibleColumnCount: number } & RowProps) {
  return (
    <>
      <tr className="bg-accent/5 border-l-4 border-accent/30">
        <td className={cell(density, 'w-10')} />
        <td className={cell(density, 'whitespace-nowrap pl-16 text-body-sm font-bold text-text-primary')}>
          Size: {size}
        </td>
        {/* Everything after the name column, whatever is left of it. Hard-coded
            at 6 this used to widen the table by one cell for every column the
            operator hid. */}
        <td colSpan={Math.max(1, visibleColumnCount - 1)}></td>
      </tr>
      {sizeVariants.map(product => (
        <tr key={product.id} className="hover:bg-primary/10 transition-colors border-l-[12px] border-primary/60 bg-surface">
          <td className={cell(density, 'w-10')} />
          <td className={cell(density, 'whitespace-nowrap')}></td>
          {isVisible('variant') && (
            <td className={cell(density, 'whitespace-nowrap')}>
              <Badge tone="primary" className="font-bold">
                Color: {capitalizeText(product.extractedColor)}
              </Badge>
            </td>
          )}
          {isVisible('category') && <td className={cell(density, 'whitespace-nowrap')}></td>}
          <VariantFigureCells product={product} isVisible={isVisible} density={density} />
        </tr>
      ))}
    </>
  );
}

function SimpleVariantRow({ product, isVisible, density }: { product: FlattenedProduct } & RowProps) {
  return (
    <tr className="hover:bg-primary/10 transition-colors border-l-4 border-primary/60 bg-surface">
      <td className={cell(density, 'w-10')} />
      <td className={cell(density, 'whitespace-nowrap')}></td>
      {isVisible('variant') && (
        <td className={cell(density, 'whitespace-nowrap')}>
          <span className="px-2 inline-flex text-caption-md leading-5 font-bold rounded-full bg-accent/10 text-accent border border-accent/30">
            {capitalizeText(product.variantLabel)}
          </span>
        </td>
      )}
      {isVisible('category') && <td className={cell(density, 'whitespace-nowrap')}></td>}
      <VariantFigureCells product={product} isVisible={isVisible} density={density} />
    </tr>
  );
}

interface VariantChildRowsProps {
  productId: string;
  variants: FlattenedProduct[];
  isVisible: ColumnVisibility;
  density: TableDensity;
  /** Excludes the leading selection cell, which is not a configurable column. */
  visibleColumnCount: number;
}

export function VariantChildRows({
  productId,
  variants,
  isVisible,
  density,
  visibleColumnCount,
}: VariantChildRowsProps) {
  if (hasCombination(variants)) {
    const sizeGroups = groupBySize(variants);
    return (
      <>
        {Object.entries(sizeGroups).map(([size, sizeVariants]) =>
          sizeVariants.length === 1 ? (
            <CombinationSingleRow
              key={sizeVariants[0].id}
              product={sizeVariants[0]}
              isVisible={isVisible}
              density={density}
            />
          ) : (
            <Fragment key={`${productId}-${size}`}>
              <CombinationGroupRows
                size={size}
                sizeVariants={sizeVariants}
                isVisible={isVisible}
                density={density}
                visibleColumnCount={visibleColumnCount}
              />
            </Fragment>
          )
        )}
      </>
    );
  }

  return (
    <>
      {variants.map(product => (
        <SimpleVariantRow key={product.id} product={product} isVisible={isVisible} density={density} />
      ))}
    </>
  );
}
