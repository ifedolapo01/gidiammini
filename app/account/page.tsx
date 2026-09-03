/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
// Every order this customer has ever placed.
//
// A server component: the session cookie is readable here, so the order list
// is in the HTML rather than arriving after a spinner. It is also the only way
// this page can exist at all without a client-side auth dance — there is no
// token in JavaScript to check, by design (the cookie is httpOnly).
//
// noindex, and never cached: it is one person's addresses and purchase history.
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { readSession } from '@/lib/commerce/customer-auth';
import { loadCustomerOrders, loadSavedDetails } from '@/lib/commerce/account-query';
import { CUSTOMER_COOKIE } from '@/lib/api/customer-session';
import { AccountOrderList } from './components/AccountOrderList';
import { SavedDetailsCard } from './components/SavedDetailsCard';
import { SignOutButton } from './components/SignOutButton';

export const metadata: Metadata = {
  title: 'Your orders',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  const supabase = createAdminClient();
  const customer = token ? await readSession(supabase, token) : null;

  // Not signed in is not an error state — it is the normal state of most
  // browsers, and the sign-in page is where it is handled.
  if (!customer) redirect('/account/login');

  const [orders, saved] = await Promise.all([
    loadCustomerOrders(supabase, customer),
    loadSavedDetails(supabase, customer),
  ]);

  return (
    <div className="min-h-screen bg-background-secondary">
      <div className="container mx-auto max-w-3xl px-4 py-8 md:py-12">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-h4 font-bold text-text-primary md:text-h3">
              {customer.fullName?.trim() ? `Hello, ${customer.fullName.split(' ')[0]}` : 'Your orders'}
            </h1>
            <p className="mt-1 text-body-sm text-text-secondary">{customer.email}</p>
          </div>
          <SignOutButton />
        </header>

        {saved && <SavedDetailsCard saved={saved} />}

        <AccountOrderList orders={orders} />

        <p className="mt-8 border-t border-divider pt-4 text-caption-md text-text-secondary">
          Need to reschedule, change the delivery method or cancel? That runs through{' '}
          <Link href="/track-order" className="text-primary underline-offset-4 hover:underline">
            order tracking
          </Link>
          , which asks for the order number so the request is tied to one order.
        </p>
      </div>
    </div>
  );
}
