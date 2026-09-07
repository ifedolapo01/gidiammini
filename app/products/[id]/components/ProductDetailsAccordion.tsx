/** STOREFRONT layer — GidiamMini branding. Depends on Core (tokens + primitives) and Commerce. */
'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, Truck, Shield } from 'lucide-react';
import { useActiveShippingZones } from '@/components/checkout/hooks/useActiveShippingZones';
import { aggregateEtaRange } from '@/lib/commerce/shipping-eta';
import { computeDeliveryWindow, formatDeliveryWindow, minutesUntilCutoffToday } from '@/lib/commerce/delivery-promise';

interface ProductDetailsAccordionProps {
  details: string[] | undefined;
}

/** Refreshed every minute so the cutoff countdown stays accurate — cheap here
 * because this is a single instance per product page, not per card. */
function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function ProductDetailsAccordion({ details }: ProductDetailsAccordionProps) {
  const { zones } = useActiveShippingZones();
  const now = useNow(60_000);
  const primaryZone = zones.find((z) => z.is_primary);
  const otherZones = zones.filter((z) => !z.is_primary);
  const otherStatesEta = aggregateEtaRange(otherZones);

  const deliveryWindow = primaryZone ? computeDeliveryWindow(now, primaryZone) : null;
  const cutoffMinutes = primaryZone ? minutesUntilCutoffToday(now, primaryZone) : null;
  const cutoffMessage =
    cutoffMinutes != null
      ? `Order within ${Math.floor(cutoffMinutes / 60)}h ${cutoffMinutes % 60}m for dispatch today`
      : primaryZone?.order_cutoff_time
        ? 'Order now for dispatch on the next working day'
        : null;

  return (
    <div className="space-y-4 border-t pt-6 md:pt-8 mt-6 md:mt-0">
      {/* Product Details List */}
      {details && details.length > 0 && (
        <div className="border rounded-control border-border-strong">
          <details className="group" open>
            <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
              <span className="font-medium text-text-primary">Product Details</span>
              <ChevronLeft className="w-5 h-5 transform group-open:rotate-90 transition-transform text-text-primary" />
            </summary>
            <div className="px-4 pb-4 text-text-secondary">
              <ul className="space-y-2 text-body-sm md:text-body-md">
                {details.map((detail, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-primary mr-2">•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </div>
      )}

      {/* Shipping & Returns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-start p-4 bg-background-secondary rounded-control">
          <Truck className="w-5 h-5 text-info mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-text-primary">Free Shipping</p>
            <p className="text-body-sm text-text-secondary">On orders over ₦50,000 in Abuja</p>
          </div>
        </div>
        <div className="flex items-start p-4 bg-background-secondary rounded-control">
          <Shield className="w-5 h-5 text-success mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-text-primary">Easy Returns</p>
            <p className="text-body-sm text-text-secondary">30-day return policy</p>
          </div>
        </div>
      </div>

      {/* Delivery Info */}
      <div className="p-4 bg-info-background border border-info-border rounded-control">
        <h4 className="font-medium text-info mb-2">Delivery Information</h4>
        <p className="text-body-sm text-info">
          {primaryZone && deliveryWindow
            ? <>• {primaryZone.state}: arrives {formatDeliveryWindow(deliveryWindow.start, deliveryWindow.end)}<br/></>
            : <>• Set your main location in Admin &rarr; Shipping to show it here<br/></>
          }
          {cutoffMessage && <>• {cutoffMessage}<br/></>}
          {otherStatesEta && <>• Other states: {otherStatesEta} to designated parks<br/></>}
          • Contact us for expedited shipping
        </p>
      </div>
    </div>
  );
}
