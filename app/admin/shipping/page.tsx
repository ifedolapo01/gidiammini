/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
'use client';

import { Plus } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import type { ShippingZone } from '@/types/shipping';
import { useShippingZones } from './hooks/useShippingZones';
import { useZoneExceptions } from './hooks/useZoneExceptions';
import { ShippingZoneTable } from './components/ShippingZoneTable';
import { ShippingZoneFormModal } from './components/ShippingZoneFormModal';

export default function ShippingPage() {
  const {
    zones, loading, error,
    isModalOpen, editingId, isSubmitting,
    formData, setFormData,
    openModal: openZoneModal, closeModal,
    handleSubmit: submitZone, handleDelete, toggleStatus,
  } = useShippingZones();

  const zoneExceptions = useZoneExceptions();

  const openModal = (zone?: ShippingZone) => {
    openZoneModal(zone);
    zoneExceptions.resetFromZone(zone?.shipping_zone_exceptions);
  };

  const handleSubmit = (e: React.FormEvent) => submitZone(e, zoneExceptions.rows);

  if (loading && zones.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" className="text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-h4 font-bold text-text-primary">Manage Shipping</h1>
          <p className="text-text-secondary">Set delivery fees, pickup locations, and contact numbers per state.</p>
        </div>
        <Button onClick={() => openModal()} className="shadow-elevation-1">
          <Plus size={18} />
          Add Zone
        </Button>
      </div>

      <ShippingZoneTable
        zones={zones}
        onToggleStatus={toggleStatus}
        onEdit={openModal}
        onDelete={handleDelete}
      />

      <ShippingZoneFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        editingId={editingId}
        formData={formData}
        setFormData={setFormData}
        exceptionRows={zoneExceptions.rows}
        onAddException={zoneExceptions.addRow}
        onUpdateException={zoneExceptions.updateRow}
        onRemoveException={zoneExceptions.removeRow}
        error={error}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
