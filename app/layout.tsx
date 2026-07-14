/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import { CartProvider } from '@/components/CartProvider';
import { Analytics } from "@vercel/analytics/next";
import StorefrontDiscountManager from '@/components/StorefrontDiscountManager';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'GidiamMini | Baby, Kids & Maternity Store',
  description: 'Premium clothing, maternity wear and essentials for babies, kids and pre-teens.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${inter.className} theme-storefront`} suppressHydrationWarning>
        <CartProvider>
          <StorefrontDiscountManager />
          <Header />
          <main className="min-h-screen overflow-x-hidden">{children}</main>
          <Analytics />
          <footer className="bg-text-primary text-text-inverse py-8 md:py-12">
            <div className="container mx-auto px-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div>
                  <h3 className="text-body-lg md:text-h5 font-bold mb-3 md:mb-4">GidiamMini</h3>
                  <p className="text-text-inverse/70 text-body-sm md:text-body-md">
                    Premium baby items, clothing, maternity wear and kids essentials.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 md:mb-4 text-body-md md:text-body-lg">Shop</h4>
                  <ul className="space-y-2 text-text-inverse/70 text-body-sm md:text-body-md">
                    <li><a href="/products" className="hover:text-text-inverse">All Products</a></li>
                    <li><a href="/products?category=babies" className="hover:text-text-inverse">Babies</a></li>
                    <li><a href="/products?category=kids" className="hover:text-text-inverse">Kids & Pre-teens</a></li>
                    <li><a href="/products?category=maternity" className="hover:text-text-inverse">Maternity</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 md:mb-4 text-body-md md:text-body-lg">Support</h4>
                  <ul className="space-y-2 text-text-inverse/70 text-body-sm md:text-body-md">
                    <li><a href="#" className="hover:text-text-inverse">Contact Us</a></li>
                    <li><a href="#" className="hover:text-text-inverse">Shipping</a></li>
                    <li><a href="#" className="hover:text-text-inverse">Returns</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 md:mb-4 text-body-md md:text-body-lg">Newsletter</h4>
                  <p className="text-text-inverse/70 mb-3 md:mb-4 text-body-sm md:text-body-md">
                    Subscribe for updates and exclusive offers.
                  </p>
                  <div className="flex">
                    <input
                      type="email"
                      placeholder="Your email"
                      className="flex-1 px-3 md:px-4 py-2 rounded-l-control text-text-primary text-body-sm md:text-body-md"
                    />
                    <button className="bg-primary px-3 md:px-4 py-2 rounded-r-control text-body-sm md:text-body-md">
                      →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}