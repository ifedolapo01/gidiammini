/** STOREFRONT layer — public Contact Us page linked from the footer. */
'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ContactForm from '@/components/contact/ContactForm';
import ContactInfoPanel from '@/components/contact/ContactInfoPanel';

export default function ContactPage() {
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
          <h1 className="text-body-lg sm:text-h5 md:text-h4 font-bold mb-1 text-text-primary">Contact Us</h1>
          <p className="text-caption-md sm:text-body-sm text-text-secondary">
            Questions about an order, a product, or shipping? Send us a message or reach out directly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6">
          <div className="md:col-span-3">
            <ContactForm />
          </div>
          <div className="md:col-span-2">
            <ContactInfoPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
