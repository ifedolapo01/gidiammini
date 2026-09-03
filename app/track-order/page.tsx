/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useTrackOrder } from '@/components/track-order/hooks/useTrackOrder';
import TrackOrderForm from '@/components/track-order/TrackOrderForm';
import TrackedOrderSummary from '@/components/track-order/TrackedOrderSummary';

export default function TrackOrderPage() {
  const {
    orderNumber, setOrderNumber,
    contact, setContact,
    order, loading, error, fieldErrors,
    trackOrder, refreshOrder, reset,
  } = useTrackOrder();

  return (
    <div className="min-h-screen bg-background-secondary overflow-x-hidden">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-2xl">
        <div className="mb-3">
          <Link
            href="/products"
            className="inline-flex items-center text-primary hover:text-primary-hover font-medium py-1 px-1"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
            <span className="text-caption-md sm:text-body-sm">Continue Shopping</span>
          </Link>
        </div>

        <div className="mb-4 sm:mb-6">
          <h1 className="text-body-lg sm:text-h5 md:text-h4 font-bold mb-1 text-text-primary">Track Your Order</h1>
          <p className="text-caption-md sm:text-body-sm text-text-secondary">
            Enter your order number and the email or phone you checked out with.
          </p>
        </div>

        {order ? (
          <div className="space-y-4">
            <button
              onClick={reset}
              className="text-primary hover:text-primary-hover font-medium text-body-sm"
            >
              ← Track a different order
            </button>
            <TrackedOrderSummary
              order={order}
              orderNumber={orderNumber}
              contact={contact}
              onOrderUpdate={refreshOrder}
            />
          </div>
        ) : (
          <TrackOrderForm
            orderNumber={orderNumber}
            setOrderNumber={setOrderNumber}
            contact={contact}
            setContact={setContact}
            loading={loading}
            error={error}
            fieldErrors={fieldErrors}
            onSubmit={trackOrder}
          />
        )}
      </div>
    </div>
  );
}
