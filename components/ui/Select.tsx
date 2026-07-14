/**
 * CORE layer — generic UI primitive. Token-based, no business branding.
 * Wraps a native <select> with a consistent cross-browser chevron, matching
 * the Input primitive's visual language (radius, border, focus treatment).
 */
'use client';

import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const sizes = {
  sm: 'h-9 text-body-sm',
  md: 'h-11 text-body-md',
  lg: 'h-12 text-body-lg',
} as const;

export type SelectSize = keyof typeof sizes;

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: SelectSize;
  invalid?: boolean;
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { size = 'md', invalid, className, wrapperClassName, children, ...props },
  ref,
) {
  return (
    <div className={cn('relative', wrapperClassName)}>
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'appearance-none rounded-control border bg-surface pl-3 pr-9 text-text-primary transition-colors',
          'focus-visible:border-focus',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-background-secondary',
          invalid ? 'border-destructive focus-visible:border-destructive' : 'border-border',
          sizes[size],
          className ?? 'w-full',
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
        aria-hidden="true"
      />
    </div>
  );
});
