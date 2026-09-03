/**
 * COMMERCE layer — the shape of a ProductCard before it has data.
 *
 * Kept beside ProductCard on purpose: the point of a skeleton is that it
 * occupies the same space as the thing it stands in for, so when the real card
 * arrives nothing on the page moves. That only stays true if the two are edited
 * together, which is much likelier when they are neighbours.
 *
 * The measurements below mirror ProductCard exactly — the 4:3 image, the p-4
 * body, the title, the two clamped description lines, the footer row.
 */
import { Skeleton } from '@/components/ui';

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-surface bg-surface shadow-elevation-2">
      {/* Matches ProductImage's aspect-[4/3] box. */}
      <Skeleton className="aspect-[4/3] w-full rounded-none" />

      <div className="p-4">
        {/* h3, text-body-lg, mb-1 */}
        <Skeleton className="mb-2 h-5 w-3/4" />
        {/* the two-line clamped description, mb-3 */}
        <Skeleton className="mb-1.5 h-4 w-full" />
        <Skeleton className="mb-3 h-4 w-5/6" />
        {/* category / "View Details →" */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
}

interface ProductGridSkeletonProps {
  /** How many placeholders to draw. Match the page's real first-page size so
   *  the scrollbar does not jump when the products replace them. */
  count?: number;
  /** The grid classes of the layout being stood in for — a listing is three
   *  across at lg, a home rail is four. Passed rather than guessed. */
  className?: string;
}

export function ProductGridSkeleton({
  count = 6,
  className = 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3',
}: ProductGridSkeletonProps) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
