/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// Where a "finish my order" link lands, and where "stop emailing me" lands too.
//
// The token identifies a basket, nothing else. It is not a sign-in and grants
// no access to an account, an order or an address — the worst it can do in the
// wrong hands is show somebody what was nearly bought, which is already in the
// email they are holding.
//
// The cart itself has to be restored in the browser, because that is where it
// lives. So this page resolves the token on the server, hands the lines to a
// client component, and that seeds localStorage and moves them on.
import type { Metadata } from 'next';
import Link from 'next/link';
import { ShoppingBag, MailX } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { buildCartEmailLines } from '@/lib/commerce/abandoned-cart';
import { cartByToken, optOutByToken } from '@/lib/commerce/abandoned-cart-query';
import { PUBLIC_VARIANTS_SELECT } from '@/lib/commerce/product-variants';
import type { Product } from '@/types/product';
import { RestoreCart, type RestoredLine } from './components/RestoreCart';

export const metadata: Metadata = {
  title: 'Your basket',
  robots: { index: false, follow: false },
};

/** A token in the URL, and a database write on the opt-out branch. */
export const dynamic = 'force-dynamic';

interface ResumePageProps {
  searchParams: Promise<{ token?: string | string[]; stop?: string }>;
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background-secondary">
      <div className="container mx-auto max-w-md px-4 py-12 md:py-16">
        <div className="rounded-surface border border-border bg-surface p-6 text-center md:p-10">
          {children}
        </div>
      </div>
    </div>
  );
}

export default async function ResumeCartPage({ searchParams }: ResumePageProps) {
  const params = await searchParams;
  // Repeated parameters arrive as arrays — the same lesson as the payment
  // callback.
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  // Typed loosely until `npm run db:types` reruns against a database that has
  // migration 004000.
  const supabase: SupabaseClient = createAdminClient();

  if (params.stop === '1') {
    const stopped = await optOutByToken(supabase, token);

    return (
      <Panel>
        <MailX className="mx-auto h-10 w-10 text-text-secondary" aria-hidden="true" />
        <h1 className="mt-3 text-h5 font-bold text-text-primary">
          {stopped ? 'That is the end of it' : 'Nothing to change'}
        </h1>
        <p className="mt-2 text-body-md text-text-secondary">
          {stopped
            ? 'We will not email you about your basket again. Order confirmations and delivery updates are separate and still work as normal.'
            : 'That link has expired, so there is nothing to turn off. If you are still getting basket emails, reply to one and we will stop them by hand.'}
        </p>
        <Link
          href="/products"
          className="mt-6 inline-flex text-body-md font-medium text-primary underline-offset-4 hover:underline"
        >
          Browse the collection →
        </Link>
      </Panel>
    );
  }

  const cart = await cartByToken(supabase, token);

  if (cart && !cart.recovered_at) {
    const { data } = await supabase
      .from('products')
      .select(`*,${PUBLIC_VARIANTS_SELECT}`)
      .in('id', [...new Set(cart.items.map((item) => item.product_id))]);

    const products = (data ?? []) as unknown as Product[];
    const byId = new Map(products.map((product) => [product.id, product]));
    const { lines } = buildCartEmailLines(cart.items, products);

    if (lines.length > 0) {
      // The cart lines the browser needs, in its own shape. Only what survived
      // buildCartEmailLines — anything sold out or delisted is simply not put
      // back, rather than restored and then rejected at checkout.
      const restored: RestoredLine[] = cart.items
        .filter((item) => byId.has(item.product_id))
        .map((item, index) => ({
          productId: item.product_id,
          name: lines[index]?.name ?? byId.get(item.product_id)!.name,
          price: lines[index]?.price ?? 0,
          image: byId.get(item.product_id)!.main_image,
          quantity: item.quantity,
          size: item.size ?? undefined,
          color: item.color ?? undefined,
        }))
        .filter((line) => line.price > 0);

      return <RestoreCart lines={restored} />;
    }
  }

  return (
    <Panel>
      <ShoppingBag className="mx-auto h-10 w-10 text-text-secondary" aria-hidden="true" />
      <h1 className="mt-3 text-h5 font-bold text-text-primary">This basket has moved on</h1>
      <p className="mt-2 text-body-md text-text-secondary">
        The link has expired, or what was in it has sold out since. Nothing is lost —
        have another look and we will save whatever you pick.
      </p>
      <Link
        href="/products"
        className="mt-6 inline-flex text-body-md font-medium text-primary underline-offset-4 hover:underline"
      >
        Browse the collection →
      </Link>
    </Panel>
  );
}
