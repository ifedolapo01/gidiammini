/** ADMIN layer — fetches shipping zones once, for the order shipping-override dropdown. */
'use client';

import { useEffect, useState } from 'react';
import type { ShippingZone } from '@/types/shipping';

export function useShippingZoneOptions() {
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchZones = async () => {
      try {
        const res = await fetch('/api/admin/shipping-zones');
        const data = await res.json();
        if (data.success) setZones(data.zones);
      } catch (error) {
        console.error('Error fetching shipping zones:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchZones();
  }, []);

  return { zones, loading };
}
