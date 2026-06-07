import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import { CartProvider } from '@/components/CartProvider';
import { Analytics } from "@vercel/analytics/next";
import StorefrontDiscountManager from '@/components/StorefrontDiscountManager';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GidiamMini | Baby, Kids & Maternity Store',
  description: 'Premium clothing, maternity wear, and essentials for babies, kids, and pre-teens.',
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
      <body className={inter.className} suppressHydrationWarning>
        <CartProvider>
          <StorefrontDiscountManager />
          <Header />
          <main className="min-h-screen overflow-x-hidden">{children}</main>
          <Analytics />
          <footer className="bg-gray-900 text-white py-8 md:py-12">
            <div className="container mx-auto px-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div>
                  <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4">GidiamMini</h3>
                  <p className="text-gray-400 text-sm md:text-base">
                    Premium baby items, clothing, maternity wear, and kids essentials.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 md:mb-4 text-base md:text-lg">Shop</h4>
                  <ul className="space-y-2 text-gray-400 text-sm md:text-base">
                    <li><a href="/products" className="hover:text-white">All Products</a></li>
                    <li><a href="/products?category=babies" className="hover:text-white">Babies</a></li>
                    <li><a href="/products?category=kids" className="hover:text-white">Kids & Pre-teens</a></li>
                    <li><a href="/products?category=maternity" className="hover:text-white">Maternity</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 md:mb-4 text-base md:text-lg">Support</h4>
                  <ul className="space-y-2 text-gray-400 text-sm md:text-base">
                    <li><a href="#" className="hover:text-white">Contact Us</a></li>
                    <li><a href="#" className="hover:text-white">Shipping</a></li>
                    <li><a href="#" className="hover:text-white">Returns</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 md:mb-4 text-base md:text-lg">Newsletter</h4>
                  <p className="text-gray-400 mb-3 md:mb-4 text-sm md:text-base">
                    Subscribe for updates and exclusive offers.
                  </p>
                  <div className="flex">
                    <input
                      type="email"
                      placeholder="Your email"
                      className="flex-1 px-3 md:px-4 py-2 rounded-l-lg text-gray-900 text-sm md:text-base"
                    />
                    <button className="bg-blue-600 px-3 md:px-4 py-2 rounded-r-lg text-sm md:text-base">
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