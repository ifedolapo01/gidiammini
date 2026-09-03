/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives). */
import { Skeleton } from '@/components/ui';

export default function CheckoutLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Skeleton className="mb-8 h-9 w-40" />
      <div className="grid gap-8 lg:grid-cols-3">
        {/* The form column. */}
        <div className="space-y-4 lg:col-span-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index}>
              <Skeleton className="mb-2 h-4 w-28" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
        </div>
        {/* The order summary. */}
        <Skeleton className="h-80 rounded-surface" />
      </div>
    </div>
  );
}
