/**
 * CORE layer — generic UI primitive. Token-based, no business branding.
 */
'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const variants = {
  default: 'rounded-control border border-border bg-surface',
  filled: 'rounded-control border border-transparent bg-background-tertiary',
  underlined: 'rounded-none border-0 border-b border-border bg-transparent px-0',
} as const;

const sizes = {
  sm: 'h-9 text-body-sm',
  md: 'h-11 text-body-md',
  lg: 'h-12 text-body-lg',
} as const;

export type InputVariant = keyof typeof variants;
export type InputSize = keyof typeof sizes;

const baseClasses = (
  variant: InputVariant,
  invalid?: boolean,
  valid?: boolean,
  className?: string,
) =>
  cn(
    'w-full text-text-primary placeholder:text-text-muted transition-colors',
    'focus-visible:border-focus',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-background-secondary',
    variants[variant],
    variant !== 'underlined' && 'px-3',
    invalid && 'border-destructive focus-visible:border-destructive',
    valid && 'border-success',
    className,
  );

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  variant?: InputVariant;
  size?: InputSize;
  /** Error state; also sets aria-invalid. */
  invalid?: boolean;
  /** Success/confirmation state. */
  valid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { variant = 'default', size = 'md', invalid, valid, className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(sizes[size], baseClasses(variant, invalid, valid, className))}
      {...props}
    />
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: InputVariant;
  invalid?: boolean;
  valid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { variant = 'default', invalid, valid, className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn('min-h-24 py-2 text-body-md', baseClasses(variant, invalid, valid, className))}
      {...props}
    />
  );
});
