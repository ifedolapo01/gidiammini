/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CategoryNavItem } from '@/lib/commerce/storefront-nav';
import NewsletterForm from './footer/NewsletterForm';

/** `categories` comes from the root layout, which reads them once per request. */
export default function Footer({ categories }: { categories: CategoryNavItem[] }) {
  const pathname = usePathname();

  // Don't render the storefront footer on admin pages
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <footer className="bg-surface-inverse text-on-inverse py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-body-lg md:text-h5 font-bold mb-3 md:mb-4">GidiamMini</h3>
            <p className="text-on-inverse/70 text-body-sm md:text-body-md">
              Premium baby items, clothing, maternity wear and kids essentials.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3 md:mb-4 text-body-md md:text-body-lg">Shop</h4>
            {/* The categories the admin actually has, not three names typed in
                here. Same list the header renders. */}
            <ul className="space-y-2 text-on-inverse/70 text-body-sm md:text-body-md">
              <li><Link href="/products" className="hover:text-on-inverse">All Products</Link></li>
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/products?category=${encodeURIComponent(category.slug)}`}
                    className="hover:text-on-inverse"
                  >
                    {category.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 md:mb-4 text-body-md md:text-body-lg">Support</h4>
            <ul className="space-y-2 text-on-inverse/70 text-body-sm md:text-body-md">
              <li><a href="/track-order" className="hover:text-on-inverse">Track Order</a></li>
              <li><a href="/contact" className="hover:text-on-inverse">Contact Us</a></li>
              <li><a href="/shipping" className="hover:text-on-inverse">Shipping</a></li>
              <li><a href="/returns" className="hover:text-on-inverse">Returns</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 md:mb-4 text-body-md md:text-body-lg">Newsletter</h4>
            <p className="text-on-inverse/70 mb-3 md:mb-4 text-body-sm md:text-body-md">
              Subscribe for updates and exclusive offers.
            </p>
            <NewsletterForm />
          </div>
        </div>
      </div>
    </footer>
  );
}
