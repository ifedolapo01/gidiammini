/**
 * ADMIN layer — what the shop cannot sell, and what it is about to run out of.
 *
 * Hand-written rather than declared against `counted()` because it is the one
 * endpoint that answers with two different alerts, at two different urgencies.
 * Nothing to sell shares priority 1 with unverified money: both are the shop
 * losing sales it has already earned.
 */
import { id, plural, read, type AlertItem, type AlertSource } from '../alert-item';
import { DEFAULT_STORE_SETTINGS } from '@/lib/commerce/store-settings';

export const stockAlerts: AlertSource = async () => {
  const data = await read('/api/admin/products/negative-stock');
  if (!data) return [];

  const alerts: AlertItem[] = [];

  if (data.outOfStockCount > 0) {
    alerts.push({
      id: id('out-of-stock'),
      type: 'out-of-stock',
      message: `🚨 ${data.outOfStockCount} product${plural(data.outOfStockCount, ' is', 's are')} out of stock`,
      link: '/admin/stock',
      tone: 'destructive',
      count: data.outOfStockCount,
      priority: 1,
      group: 'inventory',
      task: 'out-of-stock',
    });
  }

  if (data.lowStockCount > 0) {
    // The threshold the endpoint actually filtered on. This sentence used to
    // say "5 or fewer" as a literal, which stayed wrong for as long as anybody
    // had changed the query it describes.
    const threshold = data.lowStockThreshold ?? DEFAULT_STORE_SETTINGS.lowStockThreshold;

    alerts.push({
      id: id('low-stock'),
      type: 'low-stock',
      message: `⚠️ ${data.lowStockCount} product${plural(data.lowStockCount, ' is', 's are')} down to ${threshold} or fewer`,
      link: '/admin/stock',
      tone: 'warning',
      count: data.lowStockCount,
      priority: 3,
      group: 'inventory',
      task: 'low-stock',
    });
  }

  return alerts;
};
