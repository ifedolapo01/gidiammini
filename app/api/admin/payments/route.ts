// app/api/admin/payments/route.ts — records one payment-verification decision.
//
// Thin on purpose. Everything that decides what a decision means lives in
// lib/commerce/order-payments.ts, so the webhook path and any future
// reconciliation import can reach the same behaviour without going through
// HTTP. What this route adds is the two things a route is for: reading an
// untrusted body, and putting the decision in the audit trail under the name
// of whoever made it.
//
// The trail matters more here than almost anywhere else in the admin. "Who
// confirmed that this 40,000 arrived, and what did they say they saw?" is a
// question that gets asked when money is missing, and before this table
// existed the only answer was a status change with a timestamp.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { recordOrderPayment } from '@/lib/commerce/order-payments';
import type { AuditAction } from '@/lib/api/audit';
import type { PaymentStatus } from '@/types/payment';

const STATUSES: PaymentStatus[] = ['verified', 'short_paid', 'rejected'];

export const POST = withAdminAuth(async (request, { supabase, actor, audit }) => {
  const body = await request.json().catch(() => null);

  if (!body?.orderId || !STATUSES.includes(body.status)) {
    return NextResponse.json(
      { success: false, error: 'An order and an outcome are required.' },
      { status: 400 }
    );
  }

  const result = await recordOrderPayment(
    supabase,
    {
      orderId: body.orderId,
      status: body.status,
      amount: body.amount,
      method: body.method,
      reference: body.reference,
      receivedAt: body.receivedAt,
      reasonCode: body.reasonCode,
      note: body.note,
      notify: body.notify,
    },
    { id: actor.id, email: actor.email }
  );

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  audit({
    entityType: 'order',
    entityId: body.orderId,
    action: `payment_${result.status}` as AuditAction,
    after: {
      status: result.status,
      amount: body.amount ?? 0,
      reference: body.reference ?? null,
      received_at: body.receivedAt ?? null,
      received_total: result.receivedTotal,
      outstanding: result.outstanding,
      confirmed: result.confirmed,
    },
    // The verifier's own words, where they wrote any — the answer to "why was
    // this refused" without opening the payment row.
    reason: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : body.reasonCode ?? null,
  });

  return NextResponse.json({
    success: true,
    receivedTotal: result.receivedTotal,
    outstanding: result.outstanding,
    confirmed: result.confirmed,
    warning: result.warning,
  });
});
