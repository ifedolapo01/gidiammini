/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import { CartProvider } from '@/components/CartProvider';
import { WishlistProvider } from '@/components/WishlistProvider';
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
      <head>
        {/* Set data-theme before paint to avoid a flash of the wrong theme.
            Keep the storage key in sync with lib/theme.ts's THEME_STORAGE_KEY. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('gidiam-theme');var t=s||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${inter.className} theme-storefront`} suppressHydrationWarning>
        <CartProvider>
        <WishlistProvider>
          <StorefrontDiscountManager />
          <Header />
          <main className="min-h-screen overflow-x-hidden">{children}</main>
          <Analytics />
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
                  <ul className="space-y-2 text-on-inverse/70 text-body-sm md:text-body-md">
                    <li><a href="/products" className="hover:text-on-inverse">All Products</a></li>
                    <li><a href="/products?category=babies" className="hover:text-on-inverse">Babies</a></li>
                    <li><a href="/products?category=kids" className="hover:text-on-inverse">Kids & Pre-teens</a></li>
                    <li><a href="/products?category=maternity" className="hover:text-on-inverse">Maternity</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 md:mb-4 text-body-md md:text-body-lg">Support</h4>
                  <ul className="space-y-2 text-on-inverse/70 text-body-sm md:text-body-md">
                    <li><a href="#" className="hover:text-on-inverse">Contact Us</a></li>
                    <li><a href="#" className="hover:text-on-inverse">Shipping</a></li>
                    <li><a href="#" className="hover:text-on-inverse">Returns</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 md:mb-4 text-body-md md:text-body-lg">Newsletter</h4>
                  <p className="text-on-inverse/70 mb-3 md:mb-4 text-body-sm md:text-body-md">
                    Subscribe for updates and exclusive offers.
                  </p>
                  <div className="flex">
                    <input
                      type="email"
                      placeholder="Your email"
                      className="flex-1 px-3 md:px-4 py-2 rounded-l-control bg-surface text-text-primary text-body-sm md:text-body-md"
                    />
                    <button className="bg-primary px-3 md:px-4 py-2 rounded-r-control text-body-sm md:text-body-md">
                      →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </footer>
        </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}