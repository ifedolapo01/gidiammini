/** ADMIN layer — the grouped parent row and its variant rows for the stock table.
 *
 * Selection is per variant, so each child carries its own checkbox and the
 * parent carries a group toggle: a stock figure belongs to a variant, and
 * counting a shelf usually means setting every colourway of one product at
 * once.
 *
 * Both rows render one cell per column whether or not they fill it, so both
 * take the same `isVisible` predicate the header uses — otherwise hiding a
 * column would leave these rows one cell wider than the row above them.
 *
 * Padding comes from cell()/actionsCell(), the same helpers the header and the
 * single-variant row use. These were hand-written `px-6` against the parent's
 * `px-4`: the columns still lined up, but the content inside them sat two units
 * further right on every child row, which is what made the table read as
 * though its contents had drifted out of their own columns.
 */
import { formatCategoryStr, capitalizeText } from '@/lib/commerce/format-text';
import { formatCurrency } from '@/lib/commerce/pricing';
import { StockBadge } from '@/components/commerce/StockBadge';
import type { FlattenedProduct } from '@/lib/commerce/product-flatten';
import { RowCheckbox, SelectAllCheckbox } from '@/app/admin/components/SelectionCheckbox';
import type { VariantInsight } from '@/lib/commerce/inventory-analytics';
import { UpdateStockButton, StockThumbnail } from './StockRowParts';
import { StockCoverHint } from './StockCoverHint';
import type { ColumnVisibility } from '@/app/admin/hooks/useColumnVisibility';
import { actionsCell, cell, type TableDensity } from '@/app/admin/components/table';

interface ParentStockRowProps {
  parent: FlattenedProduct;
  variantsCount: number;
  /** Every variant of this product is selected. */
  allSelected: boolean;
  /** At least one, but not all. */
  someSelected: boolean;
  onToggleGroup: () => void;
  isVisible: ColumnVisibility;
  density: TableDensity;
}

export function ParentStockRow({
  parent,
  variantsCount,
  allSelected,
  someSelected,
  onToggleGroup,
  isVisible,
  density,
}: ParentStockRowProps) {
  return (
    <tr className="bg-background-secondary border-t-2 border-border">
      <td className={cell(density, 'w-10')}>
        <SelectAllCheckbox
          checked={allSelected}
          indeterminate={someSelected}
          onChange={onToggleGroup}
        />
      </td>
      <td className={cell(density, 'whitespace-nowrap pl-16')}>
        <div className="flex items-center justify-start gap-4">
          <StockThumbnail src={parent.main_image} alt={parent.name} bordered />
          <div className="text-left">
            <p className="font-bold text-text-primary">{parent.name}</p>
            <p className="text-caption-md text-text-secondary">{variantsCount} variations</p>
          </div>
        </div>
      </td>
      {isVisible('variant') && <td className={cell(density, 'whitespace-nowrap')}></td>}
      {isVisible('category') && (
        <td className={cell(density, 'whitespace-nowrap')}>
          <span className="px-2 py-1 text-caption-md rounded-full bg-background-tertiary text-text-primary font-medium capitalize">
            {formatCategoryStr(parent.category, parent.sub_category, parent.sub_sub_category)}
          </span>
        </td>
      )}
      {/* Stock and actions are per-variant here, so the parent leaves them
          empty. Neither is hideable, so both cells are always present. */}
      <td className={cell(density, 'whitespace-nowrap')}></td>
      <td className={actionsCell(density)}></td>
    </tr>
  );
}

interface ChildStockRowProps {
  product: FlattenedProduct;
  lowStockThreshold: number;
  /** See SingleStockRow. */
  insight?: VariantInsight;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: (product: FlattenedProduct) => void;
  isVisible: ColumnVisibility;
  density: TableDensity;
}

export function ChildStockRow({
  product,
  lowStockThreshold,
  insight,
  selected,
  onToggleSelect,
  onEdit,
  isVisible,
  density,
}: ChildStockRowProps) {
  let variantDisplay = capitalizeText(product.variantLabel);
  if (product.variantKey.includes('|')) {
    const [size, color] = product.variantKey.split('|');
    variantDisplay = `Size: ${size} • Color: ${capitalizeText(color)}`;
  }

  return (
    <tr className={`border-l-4 border-primary/40 ${selected ? 'bg-primary/10' : 'bg-surface hover:bg-primary/10'}`}>
      <td className={cell(density, 'w-10')}>
        <RowCheckbox
          checked={selected}
          onChange={onToggleSelect}
          rowLabel={`${product.name} · ${product.variantLabel}`}
        />
      </td>
      <td className={cell(density, 'whitespace-nowrap')}>
        {/* Empty cell for Product column indent */}
      </td>
      {isVisible('variant') && (
        <td className={cell(density, 'whitespace-nowrap')}>
          <div className="flex flex-col items-start">
            <span className="px-3 py-1 text-caption-md rounded-full bg-accent/10 text-accent font-bold border border-accent/30 mb-1">
              {variantDisplay}
            </span>
            <span className="text-body-sm tabular-nums text-text-secondary font-medium">
              {formatCurrency(product.price)}
            </span>
          </div>
        </td>
      )}
      {isVisible('category') && (
        <td className={cell(density, 'whitespace-nowrap')}>
          {/* Empty Category column */}
        </td>
      )}
      <td className={cell(density, 'whitespace-nowrap')}>
        <div className="flex flex-col items-start">
          <StockBadge
            stock={product.stock}
            lowStockThreshold={lowStockThreshold}
            hideWhenInStock={false}
            countFormat="parens"
            className="px-3 py-1.5 font-bold"
          />
          <StockCoverHint insight={insight} />
        </div>
      </td>
      <td className={actionsCell(density, 'whitespace-nowrap text-body-sm font-medium')}>
        <UpdateStockButton onClick={() => onEdit(product)} />
      </td>
    </tr>
  );
}
