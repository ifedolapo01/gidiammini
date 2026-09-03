/**
 * What state is one order actually in?
 *
 *   node scripts/diagnostics/check-order.mjs UT00100012
 *
 * Read-only. The first question to ask when a customer says they paid and the
 * order still looks unpaid: it shows whether the money was recorded
 * (payment_verified, paid_at) separately from whether the order moved
 * (status), which is the distinction that tells you where the flow broke.
 *
 * Uses the service-role key from .env.local, so it sees exactly what the
 * server sees.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'], quiet: true });

const orderNumber = process.argv[2];
if (!orderNumber) {
  console.error('Usage: node scripts/diagnostics/check-order.mjs <order number>');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from('orders')
  .select(
    'order_number, status, payment_verified, payment_method, payment_reference, paid_at, payment_channel, total_amount, receipt_path, created_at'
  )
  .eq('order_number', orderNumber)
  .maybeSingle();

if (error) {
  console.error(`error: ${error.message}`);
  process.exit(1);
}

console.log(data ? JSON.stringify(data, null, 2) : `No order numbered ${orderNumber}.`);
