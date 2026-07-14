/**
 * CORE layer — generic UI primitive. Token-based, no business branding.
 * Native checkbox styled via `accent-color` (the cross-browser-correct way to
 * tint a native checkbox's fill/tick — `color`/`border` classes alone do not
 * reliably affect it).
 */
'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { invalid, className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-invalid={invalid || undefined}
      className={cn(
        'size-4 rounded-control border-border-strong accent-primary cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid && 'border-destructive',
        className,
      )}
      {...props}
    />
  );
});
