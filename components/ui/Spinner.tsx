/**
 * CORE layer — generic UI primitive. Token-based, no business branding.
 */
import { cn } from '@/lib/utils';

const sizes = {
  xs: 'size-3',
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
  xl: 'size-8',
} as const;

export type SpinnerSize = keyof typeof sizes;

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}

export function Spinner({ size = 'md', className, label = 'Loading' }: SpinnerProps) {
  return (
    <svg
      role="status"
      aria-label={label}
      className={cn('animate-spin text-current', sizes[size], className)}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
