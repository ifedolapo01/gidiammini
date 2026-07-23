/** STOREFRONT layer — public returns & exchanges policy page linked from the footer. */
'use client';

import Link from 'next/link';
import { ArrowLeft, PackageCheck, PackageX, RotateCcw, MessageCircle } from 'lucide-react';

interface PolicyItem {
  icon: typeof PackageCheck;
  title: string;
  body: string;
}

const ELIGIBLE: PolicyItem[] = [
  {
    icon: PackageCheck,
    title: 'Within 7 days of delivery',
    body: 'Contact us within 7 days of receiving your order to request a return or exchange.',
  },
  {
    icon: PackageCheck,
    title: 'Unused and unworn',
    body: 'Items must be unworn, unwashed, and in their original condition with tags attached.',
  },
  {
    icon: PackageCheck,
    title: 'Original packaging',
    body: 'Please return items in their original packaging where possible.',
  },
];

const NOT_ELIGIBLE: PolicyItem[] = [
  {
    icon: PackageX,
    title: 'Worn or washed items',
    body: 'Items showing signs of wear, washing, or damage not caused by us cannot be returned.',
  },
  {
    icon: PackageX,
    title: 'Final sale & discounted items',
    body: 'Items marked as final sale or purchased at a clearance discount are not eligible for return.',
  },
];

function PolicyCard({ icon: Icon, title, body, tone }: PolicyItem & { tone: 'success' | 'destructive' }) {
  return (
    <div className="bg-surface border border-border rounded-control p-4">
      <Icon className={`w-5 h-5 mb-2 ${tone === 'success' ? 'text-success' : 'text-destructive'}`} />
      <p className="font-semibold text-body-sm text-text-primary mb-1">{title}</p>
      <p className="text-caption-md text-text-secondary">{body}</p>
    </div>
  );
}

export default function ReturnsPage() {
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
          <h1 className="text-body-lg sm:text-h5 md:text-h4 font-bold mb-1 text-text-primary">Returns &amp; Exchanges</h1>
          <p className="text-caption-md sm:text-body-sm text-text-secondary">
            We want you and your little ones happy with every order. Here&apos;s how returns work.
          </p>
        </div>

        <section className="mb-6 md:mb-8">
          <h2 className="font-bold text-body-md md:text-body-lg text-text-primary mb-3">Return eligibility</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {ELIGIBLE.map((item) => (
              <PolicyCard key={item.title} {...item} tone="success" />
            ))}
          </div>
        </section>

        <section className="mb-6 md:mb-8">
          <h2 className="font-bold text-body-md md:text-body-lg text-text-primary mb-3">Not eligible for return</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {NOT_ELIGIBLE.map((item) => (
              <PolicyCard key={item.title} {...item} tone="destructive" />
            ))}
          </div>
        </section>

        <section className="bg-surface border border-border rounded-surface p-4 md:p-6 mb-6 md:mb-8">
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw className="w-5 h-5 text-info" />
            <h2 className="font-bold text-body-md md:text-body-lg text-text-primary">Refunds &amp; exchanges</h2>
          </div>
          <ul className="list-disc list-inside space-y-1.5 text-caption-md md:text-body-sm text-text-secondary">
            <li>Once we receive and inspect your return, we&apos;ll confirm approval and process a refund or exchange.</li>
            <li>Refunds are issued to your original payment method and may take a few business days to reflect.</li>
            <li>Exchanges are subject to stock availability for the requested size or color.</li>
            <li>Damaged, defective, or incorrect items are covered at no extra cost — let us know right away with a photo of the item.</li>
          </ul>
        </section>

        <section className="bg-background-tertiary rounded-surface p-4 md:p-6 flex items-start gap-3">
          <MessageCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-body-sm md:text-body-md text-text-primary mb-1">Ready to start a return?</p>
            <p className="text-caption-md md:text-body-sm text-text-secondary">
              Look up your order on the <Link href="/track-order" className="text-primary hover:text-primary-hover font-medium">Track Order</Link> page and reach out to us with your order number so we can get your return or exchange sorted.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
