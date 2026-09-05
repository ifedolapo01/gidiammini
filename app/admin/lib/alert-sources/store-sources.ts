/**
 * ADMIN layer — where the shop stands, as opposed to what needs doing.
 *
 * These are not alerts. They carry no worklist task, so their rows cannot be
 * expanded and their counts are excluded from the panel's headline figure —
 * "3 things waiting" must mean three jobs, not two jobs and a product count.
 * They sort last for the same reason.
 *
 * The product count used to appear at random, roughly three times in ten, so a
 * ticker rotating six items had something different to say. In a panel that
 * stays on screen, a row that appears and disappears on reload is a bug
 * report; it now shows whenever there are products at all.
 */
import { id, read, type AlertItem, type AlertSource } from '../alert-item';

export const storeStats: AlertSource = async () => {
  const data = await read('/api/admin/alerts/dashboard-stats');
  if (!data?.success || !data.stats) return [];

  const stats = data.stats;
  const alerts: AlertItem[] = [];

  if (stats.todayOrders > 0) {
    alerts.push({
      id: id('today-orders'),
      type: 'system',
      message: `📊 ${stats.todayOrders} order${stats.todayOrders > 1 ? 's' : ''} placed today`,
      link: '/admin/orders',
      tone: 'accent',
      count: stats.todayOrders,
      priority: 6,
      group: 'store',
    });
  }

  if (stats.totalProducts > 0) {
    alerts.push({
      id: id('total-products'),
      type: 'system',
      message: `📦 ${stats.totalProducts} active products in store`,
      link: '/admin/products',
      tone: 'info',
      count: stats.totalProducts,
      priority: 7,
      group: 'store',
    });
  }

  return alerts;
};
