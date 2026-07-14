/**
 * CORE layer — generic UI primitive. Token-based, no business branding.
 */
import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-control bg-background-tertiary', className)}
      {...props}
    />
  );
}
