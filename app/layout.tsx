/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
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
          <Footer />
        </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}