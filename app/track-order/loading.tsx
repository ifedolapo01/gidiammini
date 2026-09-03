/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives). */
import { Skeleton } from '@/components/ui';

export default function TrackOrderLoading() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <Skeleton className="mx-auto mb-3 h-9 w-64" />
      <Skeleton className="mx-auto mb-8 h-5 w-80" />
      <Skeleton className="mb-3 h-11 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}
