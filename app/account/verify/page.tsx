/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// Where the emailed link lands.
//
// It asks for a button press rather than signing them in on arrival, and that
// is not politeness — mail providers and security scanners prefetch links, and
// this token is single use. Redeeming on GET would mean a customer clicking a
// link that a scanner had already spent.
import type { Metadata } from 'next';
import { VerifyPanel } from './components/VerifyPanel';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

/** The token is in the URL, so nothing about this page may be cached or
 *  prerendered. */
export const dynamic = 'force-dynamic';

interface VerifyPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function AccountVerifyPage({ searchParams }: VerifyPageProps) {
  const { token } = await searchParams;

  return (
    <div className="min-h-screen bg-background-secondary">
      <div className="container mx-auto max-w-md px-4 py-12 md:py-16">
        <VerifyPanel token={token ?? ''} />
      </div>
    </div>
  );
}
