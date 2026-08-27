/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CartProvider } from '@/components/CartProvider';
import { WishlistProvider } from '@/components/WishlistProvider';
import { Analytics } from "@vercel/analytics/next";
import StorefrontDiscountManager from '@/components/StorefrontDiscountManager';
import { Toaster } from '@/components/ui';

/**
 * Inter, self-hosted.
 *
 * Previously `Inter` from `next/font/google`, which downloads the font from
 * Google at BUILD time — so every deploy needed Google Fonts to be reachable,
 * and the build failed outright when it wasn't (twice in one afternoon here).
 * A font is not a reason for a deploy to fail.
 *
 * The file is the latin subset of Inter v20, variable weight 100-900, taken
 * straight from Google's own CDN — the exact same bytes next/font was fetching,
 * now committed. One 48KB file covers every weight because Inter is a variable
 * font. Add app/fonts/inter-latin-ext-variable.woff2 and a second src entry if
 * the store ever needs the extended latin range.
 */
const inter = localFont({
  src: './fonts/inter-latin-variable.woff2',
  variable: '--font-inter',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  // Metric-adjusted local fallback, so text laid out before the font loads
  // doesn't visibly reflow when it arrives.
  adjustFontFallback: 'Arial',
  fallback: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
});

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
        <Toaster />
      </body>
    </html>
  );
}