import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import { CartProvider } from '@/components/CartProvider';

import { Analytics } from "@vercel/analytics/next"

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'UrbanThreads Co. | Modern Streetwear',
  description: 'Minimalist clothing for everyday comfort and style',
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
    <html lang="en" style={{ overflowX: 'hidden' }} suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <CartProvider>
          <Header />
          <main className="min-h-screen overflow-x-hidden">{children}</main>
          <Analytics />
          <footer className="bg-gray-900 text-white py-8 md:py-12">
            <div className="container mx-auto px-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div>
                  <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4">UrbanThreads Co.</h3>
                  <p className="text-gray-400 text-sm md:text-base">
                    Modern streetwear designed for comfort and style.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 md:mb-4 text-base md:text-lg">Shop</h4>
                  <ul className="space-y-2 text-gray-400 text-sm md:text-base">
                    <li><a href="#" className="hover:text-white">All Products</a></li>
                    <li><a href="#" className="hover:text-white">Men</a></li>
                    <li><a href="#" className="hover:text-white">Women</a></li>
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