// app/api/admin/orders/[id]/receipt/route.ts - hands the admin a short-lived
// signed URL for one order's payment receipt.
//
// The receipts bucket is private, so this is the only way to view a receipt.
// The admin never sees or handles the object path: they ask for "the receipt for
// this order" and get a URL that stops working shortly afterwards.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { RECEIPTS_BUCKET } from '@/lib/commerce/receipt-file';

/** Long enough to open and read the image, short enough that a URL leaking into
 * a shared screenshot or a proxy log is not a lasting exposure. */
const SIGNED_URL_TTL_SECONDS = 120;

export const GET = withAdminAuth(async (_request, { supabase, params }) => {
  const { id } = await params;

  const { data: order, error } = await supabase
    .from('orders')
    .select('receipt_path')
    .eq('id', id)
    .single();

  if (error || !order) {
    return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
  }

  if (!order.receipt_path) {
    return NextResponse.json(
      { success: false, error: 'This order has no receipt attached.' },
      { status: 404 }
    );
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(order.receipt_path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    console.error('Could not sign receipt URL:', signError);
    return NextResponse.json(
      { success: false, error: 'Could not open the receipt. Please try again.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, url: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS });
});
