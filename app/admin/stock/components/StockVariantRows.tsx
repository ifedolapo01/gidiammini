/** ADMIN layer — the grouped parent row and its variant rows for the stock table.
 *
 * Selection is per variant, so each child carries its own checkbox and the
 * parent carries a group toggle: a stock figure belongs to a variant, and
 * counting a shelf usually means setting every colourway of one product at
 * once.
 */
import { formatCategoryStr, capitalizeText } from '@/lib/commerce/format-text';
import { formatCurrency } from '@/lib/commerce/pricing';
import { StockBadge } from '@/components/commerce/StockBadge';
import type { FlattenedProduct } from '@/lib/commerce/product-flatten';
import { RowCheckbox, SelectAllCheckbox } from '@/app/admin/components/SelectionCheckbox';
import type { VariantInsight } from '@/lib/commerce/inventory-analytics';
import { UpdateStockButton, StockThumbnail } from './StockRowParts';
import { StockCoverHint } from './StockCoverHint';

interface ParentStockRowProps {
  parent: FlattenedProduct;
  variantsCount: number;
  /** Every variant of this product is selected. */
  allSelected: boolean;
  /** At least one, but not all. */
  someSelected: boolean;
  onToggleGroup: () => void;
}

export function ParentStockRow({
  parent,
  variantsCount,
  allSelected,
  someSelected,
  onToggleGroup,
}: ParentStockRowProps) {
  return (
    <tr className="bg-background-secondary border-t-2 border-border">
      <td className="px-4 py-3 w-10">
        <SelectAllCheckbox
          checked={allSelected}
          indeterminate={someSelected}
          onChange={onToggleGroup}
        />
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-left pl-16">
        <div className="flex items-center justify-start gap-4">
          <StockThumbnail src={parent.main_image} alt={parent.name} bordered />
          <div className="text-left">
            <p className="font-bold text-text-primary">{parent.name}</p>
            <p className="text-caption-md text-text-secondary">{variantsCount} variations</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-center"></td>
      <td className="px-6 py-3 whitespace-nowrap text-center">
        <span className="px-2 py-1 text-caption-md rounded-full bg-background-tertiary text-text-primary font-medium capitalize">
          {formatCategoryStr(parent.category, parent.sub_category)}
        </span>
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-center"></td>
      <td className="px-6 py-3 whitespace-nowrap text-center"></td>
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
}

export function ChildStockRow({
  product,
  lowStockThreshold,
  insight,
  selected,
  onToggleSelect,
  onEdit,
}: ChildStockRowProps) {
  let variantDisplay = capitalizeText(product.variantLabel);
  if (product.variantKey.includes('|')) {
    const [size, color] = product.variantKey.split('|');
    variantDisplay = `Size: ${size} • Color: ${capitalizeText(color)}`;
  }

  return (
    <tr className={`border-l-4 border-primary/40 ${selected ? 'bg-primary/10' : 'bg-surface hover:bg-primary/10'}`}>
      <td className="px-4 py-3 w-10">
        <RowCheckbox
          checked={selected}
          onChange={onToggleSelect}
          rowLabel={`${product.name} · ${product.variantLabel}`}
        />
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-center">
        {/* Empty cell for Product column indent */}
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-center">
        <div className="flex flex-col items-center justify-center">
          <span className="px-3 py-1 text-caption-md rounded-full bg-accent/10 text-accent font-bold border border-accent/30 mb-1">
            {variantDisplay}
          </span>
          <span className="text-body-sm text-text-secondary font-medium">{formatCurrency(product.price)}</span>
        </div>
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-center">
        {/* Empty Category column */}
      </td>
      <td className="px-6 py-3 whitespace-nowrap text-center">
        <div className="flex flex-col items-center justify-center">
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
      <td className="px-6 py-3 whitespace-nowrap text-body-sm font-medium text-center">
        <UpdateStockButton onClick={() => onEdit(product)} />
      </td>
    </tr>
  );
}
