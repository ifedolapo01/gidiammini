/**
 * ADMIN layer — money waiting to be confirmed.
 *
 * Two alerts from one endpoint, and deliberately not one: a receipt to check
 * is a decision somebody can make in five seconds, while a part-paid order is
 * a customer to chase for a balance. Adding them together would produce a
 * number that cannot be cleared by doing either job — which is exactly the
 * problem the worklist exists to fix.
 *
 * Both sit at the top of the priority order. Verifying receipts is the
 * highest-frequency, highest-stakes task in the shop: every unverified receipt
 * is a customer who has paid and is waiting, and until somebody looks, the
 * money is not really the shop's. Nothing else on the worklist is asked of an
 * operator several times a day.
 */
import { id, plural, read, type AlertItem, type AlertSource } from '../alert-item';

export const paymentAlerts: AlertSource = async () => {
  const data = await read('/api/admin/alerts/payment-verification');
  if (!data?.success) return [];

  const alerts: AlertItem[] = [];

  if (data.pendingCount > 0) {
    alerts.push({
      id: id('payment-verification'),
      type: 'payment-verification',
      message: `🧾 ${data.pendingCount} receipt${plural(data.pendingCount, ' is', 's are')} waiting to be verified`,
      link: '/admin/payments',
      tone: 'destructive',
      count: data.pendingCount,
      priority: 1,
      group: 'money',
      task: 'receipts',
    });
  }

  if (data.partPaidCount > 0) {
    alerts.push({
      id: id('part-paid'),
      type: 'part-paid',
      message: `💸 ${data.partPaidCount} order${plural(data.partPaidCount, ' has', 's have')} only been part paid`,
      link: '/admin/payments',
      tone: 'warning',
      count: data.partPaidCount,
      priority: 2,
      group: 'money',
      task: 'part-paid',
    });
  }

  return alerts;
};
