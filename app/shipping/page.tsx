/** STOREFRONT layer — public shipping information page linked from the footer. */
'use client';

import Link from 'next/link';
import { ArrowLeft, Clock, Truck, ShieldCheck } from 'lucide-react';
import ShippingZonesList from '@/components/shipping/ShippingZonesList';

const STEPS = [
  {
    icon: Clock,
    title: 'Payment verification',
    body: 'Once your order is placed, we verify payment within 24 hours before it moves to processing.',
  },
  {
    icon: Truck,
    title: 'Delivery or pickup',
    body: 'We arrange doorstep delivery or a pickup, depending on what your delivery zone supports.',
  },
  {
    icon: ShieldCheck,
    title: 'Order tracking',
    body: 'Track your order any time from the Track Order page using your order number and contact details.',
  },
];

export default function ShippingPage() {
  return (
    <div className="min-h-screen bg-background-secondary overflow-x-hidden">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-3xl">
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
          <h1 className="text-body-lg sm:text-h5 md:text-h4 font-bold mb-1 text-text-primary">Shipping Information</h1>
          <p className="text-caption-md sm:text-body-sm text-text-secondary">
            How we process, deliver, and hand off your order.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 md:mb-8">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-surface border border-border rounded-control p-4">
              <Icon className="w-5 h-5 text-info mb-2" />
              <p className="font-semibold text-body-sm text-text-primary mb-1">{title}</p>
              <p className="text-caption-md text-text-secondary">{body}</p>
            </div>
          ))}
        </div>

        <section className="mb-6 md:mb-8">
          <h2 className="font-bold text-body-md md:text-body-lg text-text-primary mb-3">Delivery zones &amp; fees</h2>
          <ShippingZonesList />
          <p className="text-caption-md text-text-secondary mt-3">
            Fees and estimated delivery times vary by location and are confirmed at checkout. Don&apos;t see your area listed?
            {' '}<Link href="/track-order" className="text-primary hover:text-primary-hover font-medium">Contact us</Link> to check availability.
          </p>
        </section>

        <section className="bg-surface border border-border rounded-surface p-4 md:p-6">
          <h2 className="font-bold text-body-md md:text-body-lg text-text-primary mb-2">Notes</h2>
          <ul className="list-disc list-inside space-y-1.5 text-caption-md md:text-body-sm text-text-secondary">
            <li>Delivery timelines begin after payment verification, not from the order date.</li>
            <li>For pickup orders, we&apos;ll notify you once your order is ready to collect.</li>
            <li>Need to reschedule or switch between delivery and pickup? You can request that from the <Link href="/track-order" className="text-primary hover:text-primary-hover font-medium">Track Order</Link> page.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
