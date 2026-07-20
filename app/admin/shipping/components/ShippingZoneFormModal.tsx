/** ADMIN layer — create/edit shipping zone modal form. */
'use client';

import { Dispatch, SetStateAction } from 'react';
import { Button, Input, Modal, Checkbox } from '@/components/ui';
import type { ShippingZoneFormData } from '../hooks/useShippingZones';
import type { ZoneExceptionFormRow } from '../hooks/useZoneExceptions';
import { ZoneGeographyFields } from './ZoneGeographyFields';
import { ZoneEtaFields } from './ZoneEtaFields';
import { ZoneAvailabilityFields } from './ZoneAvailabilityFields';
import { ZoneExceptionsFields } from './ZoneExceptionsFields';

interface ShippingZoneFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingId: string | null;
  formData: ShippingZoneFormData;
  setFormData: Dispatch<SetStateAction<ShippingZoneFormData>>;
  exceptionRows: ZoneExceptionFormRow[];
  onAddException: () => void;
  onUpdateException: (index: number, patch: Partial<ZoneExceptionFormRow>) => void;
  onRemoveException: (index: number) => void;
  error: string;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function ShippingZoneFormModal({
  isOpen, onClose, editingId, formData, setFormData,
  exceptionRows, onAddException, onUpdateException, onRemoveException,
  error, isSubmitting, onSubmit,
}: ShippingZoneFormModalProps) {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="lg"
      scrollable
      padded={false}
      title={editingId ? 'Edit Shipping Zone' : 'Create Shipping Zone'}
      headerClassName="border-b border-border-light bg-background-secondary/50"
    >
      <form onSubmit={onSubmit} className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-destructive-background text-destructive text-body-sm rounded-control border border-destructive-border">
            {error}
          </div>
        )}

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-body-sm font-semibold text-text-primary mb-1.5">Zone Label</label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Abuja Express"
                required
              />
            </div>
            <div>
              <label className="block text-body-sm font-semibold text-text-primary mb-1.5">Delivery Fee (₦)</label>
              <Input
                type="number" onFocus={(e) => e.target.select()}
                value={formData.delivery_fee}
                onChange={(e) => setFormData({ ...formData, delivery_fee: e.target.value })}
                placeholder="e.g. 5000"
                min="0"
                required
              />
            </div>
          </div>

          <ZoneGeographyFields formData={formData} setFormData={setFormData} />

          <ZoneEtaFields formData={formData} setFormData={setFormData} />

          <ZoneAvailabilityFields formData={formData} setFormData={setFormData} />

          <ZoneExceptionsFields
            rows={exceptionRows}
            parentState={formData.state}
            parentLga={formData.lga}
            onAdd={onAddException}
            onUpdate={onUpdateException}
            onRemove={onRemoveException}
          />

          <div>
            <label className="block text-body-sm font-semibold text-text-primary mb-1.5">Sort Order</label>
            <Input
              type="number" onFocus={(e) => e.target.select()}
              value={formData.sort_order}
              onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
              placeholder="0"
              min="0"
            />
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border-light">
            <Checkbox
              id="is_primary"
              checked={formData.is_primary}
              onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
            />
            <label htmlFor="is_primary" className="text-body-sm font-medium text-text-primary">
              Main location <span className="text-text-muted font-normal">(drives the product page's headline delivery estimate — only one zone can be primary)</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            />
            <label htmlFor="is_active" className="text-body-sm font-medium text-text-primary">Active (visible to customers at checkout)</label>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={isSubmitting || !formData.name || !formData.delivery_fee}
          >
            {editingId ? 'Save Changes' : 'Create Zone'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
