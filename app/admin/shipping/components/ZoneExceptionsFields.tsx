/** ADMIN layer — repeatable list of fee/ETA-only exception rows carved out of
 * the parent zone being edited. */
'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button, Input, Select, Textarea } from '@/components/ui';
import { NIGERIA_STATES_LGAS } from '@/lib/data/nigeria-states-lgas';
import { formatEtaRange } from '@/lib/commerce/shipping-eta';
import type { ZoneExceptionFormRow } from '../hooks/useZoneExceptions';

interface ZoneExceptionsFieldsProps {
  rows: ZoneExceptionFormRow[];
  parentState: string;
  parentLga: string;
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<ZoneExceptionFormRow>) => void;
  onRemove: (index: number) => void;
}

export function ZoneExceptionsFields({ rows, parentState, parentLga, onAdd, onUpdate, onRemove }: ZoneExceptionsFieldsProps) {
  const lgas = NIGERIA_STATES_LGAS[parentState] || [];

  return (
    <div className="pt-2 border-t border-border-light">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-body-sm font-semibold text-text-primary">
          Exceptions <span className="font-normal text-text-muted text-caption-md">(carve out a cheaper/slower LGA or district/town — only fee/ETA can differ)</span>
        </label>
        <Button type="button" variant="secondary" size="sm" onClick={onAdd}>
          <Plus size={14} /> Add Exception
        </Button>
      </div>

      {rows.length === 0 && (
        <p className="text-caption-md text-text-muted">No exceptions — this zone applies uniformly.</p>
      )}

      <div className="space-y-4">
        {rows.map((row, index) => {
          const min = Number(row.delivery_eta_min) || 0;
          const previewUnit = row.delivery_eta_unit || 'days';

          return (
            <div key={index} className="p-3 rounded-control border border-border-light bg-background-secondary/50 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 grid grid-cols-2 gap-3">
                  {parentLga ? (
                    <div className="col-span-2 text-caption-md text-text-muted">Applies within {parentLga}</div>
                  ) : (
                    <div>
                      <label className="block text-caption-md font-medium text-text-secondary mb-1">LGA</label>
                      <Select value={row.lga} onChange={(e) => onUpdate(index, { lga: e.target.value })}>
                        <option value="" disabled>Select LGA</option>
                        {lgas.map((lga) => (
                          <option key={lga} value={lga}>{lga}</option>
                        ))}
                      </Select>
                    </div>
                  )}
                  <div className={parentLga ? 'col-span-2' : ''}>
                    <label className="block text-caption-md font-medium text-text-secondary mb-1">
                      Districts/Towns <span className="text-text-muted">(optional, one per line)</span>
                    </label>
                    <Textarea
                      value={row.places}
                      onChange={(e) => onUpdate(index, { places: e.target.value })}
                      placeholder="Leave blank to cover the whole LGA"
                      rows={2}
                    />
                  </div>
                </div>
                <button type="button" onClick={() => onRemove(index)} className="text-text-muted hover:text-destructive p-1" title="Remove exception">
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-caption-md font-medium text-text-secondary mb-1">Fee (₦)</label>
                  <Input
                    type="number" onFocus={(e) => e.target.select()}
                    value={row.delivery_fee}
                    onChange={(e) => onUpdate(index, { delivery_fee: e.target.value })}
                    placeholder="Inherit"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-caption-md font-medium text-text-secondary mb-1">ETA Min</label>
                  <Input
                    type="number" onFocus={(e) => e.target.select()}
                    value={row.delivery_eta_min}
                    onChange={(e) => onUpdate(index, { delivery_eta_min: e.target.value })}
                    placeholder="Inherit"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-caption-md font-medium text-text-secondary mb-1">ETA Max</label>
                  <Input
                    type="number" onFocus={(e) => e.target.select()}
                    value={row.delivery_eta_max}
                    onChange={(e) => onUpdate(index, { delivery_eta_max: e.target.value })}
                    placeholder="Inherit"
                    min="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-caption-md font-medium text-text-secondary mb-1">Unit</label>
                  <Select
                    value={row.delivery_eta_unit}
                    onChange={(e) => onUpdate(index, { delivery_eta_unit: e.target.value as ZoneExceptionFormRow['delivery_eta_unit'] })}
                  >
                    <option value="">Inherit</option>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </Select>
                </div>
                {min > 0 && (
                  <p className="text-caption-md text-text-muted">
                    Preview: {formatEtaRange(min, Number(row.delivery_eta_max) || min, previewUnit)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
