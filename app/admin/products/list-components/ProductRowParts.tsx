/**
 * ADMIN layer — the two cells the single row and the grouped parent row share.
 *
 * Split out of ProductTableRow when the density parameter pushed that file
 * past the file-size limit. Both are pure presentation and neither knows which
 * kind of row it is sitting in.
 */
'use client';

import { Edit, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { RowCheckbox } from '@/app/admin/components/SelectionCheckbox';
import RowActionsMenu from '@/app/admin/components/RowActionsMenu';

interface SelectionCellProps {
  productId: string;
  name: string;
  selected: boolean;
  onToggleSelect: (productId: string) => void;
  /** The density-aware cell classes, from components/table's `cell()`. */
  padded: string;
}

/** The leading selection cell. Bulk actions apply to products, so both the
 * single row and the grouped parent row carry one and variant child rows do
 * not. */
export function SelectionCell({
  productId,
  name,
  selected,
  onToggleSelect,
  padded,
}: SelectionCellProps) {
  return (
    <td className={`${padded} w-10`}>
      <RowCheckbox checked={selected} onChange={() => onToggleSelect(productId)} rowLabel={name} />
    </td>
  );
}

interface RowActionsProps {
  productId: string;
  /** Names the row in the menu's header and its accessible label. */
  productName: string;
  onDelete: (productId: string) => void;
}

export function RowActions({ productId, productName, onDelete }: RowActionsProps) {
  const router = useRouter();

  return (
    <div className="flex justify-center">
      <RowActionsMenu
        rowLabel={productName}
        actions={[
          {
            label: 'Edit product',
            icon: <Edit size={15} aria-hidden />,
            // router.push rather than a Link: a menu item is a button, and
            // nesting an anchor inside one to keep the navigation declarative
            // would be invalid markup that a screen reader reads twice.
            onClick: () => router.push(`/admin/products/edit/${productId}`),
          },
          {
            label: 'Delete product',
            icon: <Trash2 size={15} aria-hidden />,
            onClick: () => onDelete(productId),
            destructive: true,
          },
        ]}
      />
    </div>
  );
}
