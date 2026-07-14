/**
 * CORE layer — generic UI primitive. Token-based, no business branding.
 * Brand appearance comes entirely from the active theme scope
 * (.theme-storefront / .theme-admin) via semantic tokens.
 */
'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';

const variants = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-secondary-hover active:bg-secondary-active',
  outline:
    'border border-border-strong bg-transparent text-text-primary hover:bg-surface-hover active:bg-surface-active',
  ghost:
    'bg-transparent text-text-primary hover:bg-surface-hover active:bg-surface-active',
  link:
    'bg-transparent text-primary underline-offset-4 hover:underline h-auto px-0',
  success: 'bg-success text-text-inverse hover:opacity-90 active:opacity-80',
  warning: 'bg-warning text-text-inverse hover:opacity-90 active:opacity-80',
  destructive:
    'bg-destructive text-text-inverse hover:opacity-90 active:opacity-80',
} as const;

const sizes = {
  sm: 'h-9 px-3 text-body-sm',
  md: 'h-11 px-4 text-body-md',
  lg: 'h-12 px-6 text-body-lg',
} as const;

const contentGaps = {
  sm: 'gap-1.5',
  md: 'gap-2',
  lg: 'gap-2',
} as const;

/* Icon-only buttons stay square and keep the 44px touch target at md. */
const iconSizes = {
  sm: 'size-9',
  md: 'size-11',
  lg: 'size-12',
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Square icon-only button; provide an aria-label. */
  icon?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon = false, loading = false, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex items-center justify-center rounded-control font-medium',
        'transition-colors select-none',
        'active:scale-95',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        icon ? iconSizes[size] : sizes[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner size={size === 'lg' ? 'md' : 'sm'} />
        </span>
      )}
      <span className={cn('inline-flex items-center', contentGaps[size], loading && 'invisible')}>
        {children}
      </span>
    </button>
  );
});
