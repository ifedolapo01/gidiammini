/** STOREFRONT layer — fetches admin-managed, active shipping zones for checkout. */
import { useEffect, useState } from 'react';
import type { ShippingZone } from '@/types/shipping';

export function useActiveShippingZones() {
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchZones = async () => {
      try {
        const response = await fetch('/api/shipping-zones');
        const data = await response.json();
        if (!cancelled && data.success) {
          setZones(data.zones);
        }
      } catch (error) {
        console.error('Error fetching shipping zones:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchZones();
    return () => { cancelled = true; };
  }, []);

  return { zones, loading };
}
