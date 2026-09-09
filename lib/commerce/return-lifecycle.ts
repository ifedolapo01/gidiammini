/**
 * COMMERCE layer (server only) — the return lifecycle's transitions.
 *
 * Four are a plain status move: read the row, check return-status.ts agrees
 * the move is legal from where it is, write it. The fifth — restocking — also
 * credits stock (via the restock_return_item RPC, which is where the
 * inventory_movements row actually gets written, same "a trigger records it
 * because the stock moved" reasoning as every other stock change in this
 * schema) and records a refund alongside it: the whole point of gating
 * refunds behind inspection and restock is that money moves at a deliberate
 * step, never bundled into 'approved' the way the old order_change_requests
 * flow did it. Settling that refund — see refund-settlement.ts — is the only
 * way a return reaches 'refunded'.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { StatusChangeActor } from './order-status-transition';
import { recordOrderRefund } from './order-refunds';
import { canTransitionReturn } from './return-status';
import type { Return, ReturnStatus } from '@/types/return';

export type ReturnLifecycleResult =
  | { ok: true; return: Return }
  | { ok: false; error: string; status: number };

async function readReturn(supabase: SupabaseClient, returnId: string): Promise<Return | null> {
  const { data, error } = await supabase.from('returns').select('*').eq('id', returnId).maybeSingle();
  if (error || !data) return null;
  return data as Return;
}

/** Moves a return to `next`, guarded twice: once here (canTransitionReturn,
 *  for a message a human can read) and once by the `.eq('status', ...)` on
 *  the write, so two concurrent requests reading the same starting status
 *  cannot both apply their move — the loser's UPDATE matches no row. */
async function transition(
  supabase: SupabaseClient,
  returnId: string,
  next: ReturnStatus,
  extra: Record<string, unknown>
): Promise<ReturnLifecycleResult> {
  const current = await readReturn(supabase, returnId);
  if (!current) return { ok: false, error: 'Return not found', status: 404 };

  if (!canTransitionReturn(current.status, next)) {
    return {
      ok: false,
      error: `This return is ${current.status} — it cannot move to ${next} from here.`,
      status: 400,
    };
  }

  const { data, error } = await supabase
    .from('returns')
    .update({ status: next, updated_at: new Date().toISOString(), ...extra })
    .eq('id', returnId)
    .eq('status', current.status)
    .select('*')
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: 'Could not update this return. Someone may have just changed it.', status: 409 };
  }

  return { ok: true, return: data as Return };
}

export function approveReturn(
  supabase: SupabaseClient,
  returnId: string,
  actor: StatusChangeActor,
  adminResponse?: string
): Promise<ReturnLifecycleResult> {
  return transition(supabase, returnId, 'approved', {
    approved_at: new Date().toISOString(),
    actor_id: actor.id,
    admin_response: adminResponse ?? null,
  });
}

export function rejectReturn(
  supabase: SupabaseClient,
  returnId: string,
  actor: StatusChangeActor,
  adminResponse?: string
): Promise<ReturnLifecycleResult> {
  return transition(supabase, returnId, 'rejected', {
    rejected_at: new Date().toISOString(),
    actor_id: actor.id,
    admin_response: adminResponse ?? null,
  });
}

export function markReturnReceived(
  supabase: SupabaseClient,
  returnId: string,
  actor: StatusChangeActor
): Promise<ReturnLifecycleResult> {
  return transition(supabase, returnId, 'received', {
    received_at: new Date().toISOString(),
    actor_id: actor.id,
  });
}

export function markReturnInspected(
  supabase: SupabaseClient,
  returnId: string,
  actor: StatusChangeActor
): Promise<ReturnLifecycleResult> {
  return transition(supabase, returnId, 'inspected', {
    inspected_at: new Date().toISOString(),
    actor_id: actor.id,
  });
}

/** Credits stock for every not-yet-restocked line (restock_return_item),
 *  then records a refund against the order — pending, not settled, exactly
 *  like every other refund in this codebase — and links it back onto the
 *  return so refund-settlement.ts can find it later. The RPC itself is the
 *  transition guard: it refuses anything not 'inspected', so a return-status
 *  check here would only duplicate it. */
export async function restockReturn(
  supabase: SupabaseClient,
  returnId: string,
  actor: StatusChangeActor,
  refundAmount: number
): Promise<ReturnLifecycleResult> {
  const before = await readReturn(supabase, returnId);
  if (!before) return { ok: false, error: 'Return not found', status: 404 };

  const { error: restockError } = await supabase.rpc('restock_return_item', {
    p_return_id: returnId,
    p_actor_id: actor.id,
  });

  if (restockError) {
    return { ok: false, error: restockError.message, status: 400 };
  }

  const refund = await recordOrderRefund(
    supabase,
    {
      orderId: before.order_id,
      amount: refundAmount,
      method: 'transfer',
      reasonCode: 'customer_return',
      note: before.reason,
      settled: false,
      returnId,
    },
    actor
  );

  if (!refund.ok) {
    // Stock is already back on the shelf — that part cannot be undone here
    // without risking a second movement row for the same units, and a
    // restocked-but-unrefunded return is a state an admin can still see and
    // fix from the Returns panel (retry the refund, or investigate). Leaving
    // the money agreement out is safer than guessing at a rollback.
    return { ok: false, error: refund.error, status: refund.status };
  }

  const { data, error } = await supabase
    .from('returns')
    .update({ refund_id: refund.refundId })
    .eq('id', returnId)
    .select('*')
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: 'Restocked and refund recorded, but could not link them. Check the Refunds tab.', status: 500 };
  }

  return { ok: true, return: data as Return };
}
