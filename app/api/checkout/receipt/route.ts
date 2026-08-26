// app/api/checkout/receipt/route.ts - receives a customer's payment receipt.
//
// Replaces a browser-side upload straight into the storage bucket with the anon
// key. Two things that could not be enforced there are enforced here: the file
// is actually an image of an accepted type and size (checked against its magic
// bytes, not the caller's Content-Type header), and the object lands on a
// random path in a private bucket rather than a guessable
// {orderNumber}-{timestamp} one in a public bucket.
//
// Public, because the receipt is uploaded before the order row exists — the
// checkout flow is upload-then-create. It returns only an opaque object path;
// nothing here can read an existing receipt back out.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { validateReceipt, buildReceiptPath, MAX_RECEIPT_BYTES, RECEIPTS_BUCKET } from '@/lib/commerce/receipt-file';

/** Cheap guard before the body is read, so an oversized upload is rejected
 * without buffering it. The real check still runs on the actual bytes. */
function declaredTooLarge(request: NextRequest): boolean {
  const length = Number(request.headers.get('content-length'));
  // +1MB of slack for multipart overhead.
  return Number.isFinite(length) && length > MAX_RECEIPT_BYTES + 1024 * 1024;
}

export async function POST(request: NextRequest) {
  try {
    if (declaredTooLarge(request)) {
      return NextResponse.json(
        { success: false, error: 'That file is too large. Please upload an image under 5MB.' },
        { status: 413 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('receipt');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'No receipt file was attached.' },
        { status: 400 }
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const validation = validateReceipt(file.type, bytes.byteLength, bytes);

    if (!validation.ok) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const path = buildReceiptPath(validation.extension);
    const supabase = createAdminClient();

    const { error } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .upload(path, bytes, { contentType: validation.mime, upsert: false });

    if (error) {
      console.error('Receipt upload failed:', error);
      return NextResponse.json(
        { success: false, error: 'We could not save your receipt. Please try again.' },
        { status: 502 }
      );
    }

    // The path only — never a URL. Reading a receipt back requires a signed URL
    // from the admin-only endpoint.
    return NextResponse.json({ success: true, path });
  } catch (error: any) {
    console.error('Error handling receipt upload:', error);
    return NextResponse.json(
      { success: false, error: 'We could not process your receipt. Please try again.' },
      { status: 500 }
    );
  }
}
