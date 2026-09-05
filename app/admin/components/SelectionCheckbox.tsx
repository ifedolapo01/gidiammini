/** ADMIN layer — the checkbox in a selectable table's first column.
 *
 * Two thin wrappers over the Core Checkbox primitive, here so every admin
 * table labels its selection controls the same way. Screen-reader labels name
 * the row ("Select order GM-1042"), because "checkbox, checkbox, checkbox" down
 * a column is unusable.
 */
'use client';

import { useEffect, useRef } from 'react';
import { Checkbox } from '@/components/ui';

interface SelectAllCheckboxProps {
  checked: boolean;
  /** Some but not all visible rows selected. */
  indeterminate: boolean;
  onChange: () => void;
  disabled?: boolean;
}

export function SelectAllCheckbox({ checked, indeterminate, onChange, disabled }: SelectAllCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  // `indeterminate` is a DOM property with no HTML attribute, so React cannot
  // set it declaratively.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <Checkbox
      ref={ref}
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      aria-label={checked ? 'Deselect all rows on this page' : 'Select all rows on this page'}
    />
  );
}

interface RowCheckboxProps {
  checked: boolean;
  onChange: () => void;
  /** What this row is, for the accessible name. */
  rowLabel: string;
  disabled?: boolean;
}

export function RowCheckbox({ checked, onChange, rowLabel, disabled }: RowCheckboxProps) {
  return (
    <Checkbox
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      aria-label={`${checked ? 'Deselect' : 'Select'} ${rowLabel}`}
      // Rows are often clickable; the checkbox must not also trigger the row.
      onClick={(event) => event.stopPropagation()}
    />
  );
}
