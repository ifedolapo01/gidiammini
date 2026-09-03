/**
 * CORE layer — generic UI primitive. Token-based, no business branding.
 *
 * The message shown under an input that failed validation. Rendered as a live
 * region so a screen reader announces it when it appears after a submit, and
 * carries an `id` for the input's `aria-describedby` — without that link the
 * error is visible but never associated with the field it belongs to.
 */
'use client';

import { cn } from '@/lib/utils';

export interface FieldErrorProps {
  /** Referenced by the input's aria-describedby. */
  id?: string;
  children?: string;
  className?: string;
}

export function FieldError({ id, children, className }: FieldErrorProps) {
  if (!children) return null;

  return (
    <p id={id} role="alert" className={cn('mt-1 text-caption-md text-destructive', className)}>
      {children}
    </p>
  );
}

/** The id convention pairing an input with its message, so the input and the
 * error agree without each caller inventing one. */
export function fieldErrorId(field: string): string {
  return `${field}-error`;
}
