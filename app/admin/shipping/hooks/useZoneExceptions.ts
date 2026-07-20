/** ADMIN layer — manages the in-form list of exception rows for the shipping
 * zone modal (kept separate from useShippingZones.ts, which is already close
 * to the file-size cap). Exceptions are submitted alongside the parent zone. */
'use client';

import { useState } from 'react';
import type { ShippingEtaUnit, ShippingZoneException } from '@/types/shipping';

export interface ZoneExceptionFormRow {
  id?: string;
  /** '' = inherit the parent zone's own LGA (only valid when the parent is itself LGA-scoped). */
  lga: string;
  places: string;
  delivery_fee: string;
  delivery_eta_min: string;
  delivery_eta_max: string;
  delivery_eta_unit: ShippingEtaUnit | '';
}

const emptyRow: ZoneExceptionFormRow = {
  lga: '',
  places: '',
  delivery_fee: '',
  delivery_eta_min: '',
  delivery_eta_max: '',
  delivery_eta_unit: '',
};

function toFormRow(exception: ShippingZoneException): ZoneExceptionFormRow {
  return {
    id: exception.id,
    lga: exception.lga || '',
    places: exception.places || '',
    delivery_fee: exception.delivery_fee?.toString() ?? '',
    delivery_eta_min: exception.delivery_eta_min?.toString() ?? '',
    delivery_eta_max: exception.delivery_eta_max?.toString() ?? '',
    delivery_eta_unit: exception.delivery_eta_unit ?? '',
  };
}

export function useZoneExceptions() {
  const [rows, setRows] = useState<ZoneExceptionFormRow[]>([]);

  const addRow = () => setRows((prev) => [...prev, { ...emptyRow }]);

  const updateRow = (index: number, patch: Partial<ZoneExceptionFormRow>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const resetFromZone = (exceptions?: ShippingZoneException[]) => {
    setRows((exceptions ?? []).map(toFormRow));
  };

  return { rows, addRow, updateRow, removeRow, resetFromZone };
}
