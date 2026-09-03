/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui';

export function SignOutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      loading={signingOut}
      onClick={async () => {
        setSigningOut(true);
        await fetch('/api/account/logout', { method: 'POST' });
        // refresh() as well as replace(): the account page is a server
        // component, so its cached render has to be discarded or the signed-out
        // browser is shown the signed-in HTML.
        router.replace('/');
        router.refresh();
      }}
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      Sign out
    </Button>
  );
}
