/** ADMIN layer — shipping zone CRUD state: fetches zones and talks to /api/admin/shipping-zones. */
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui';
import { useShippingZoneStatus } from './useShippingZoneStatus';
import type { ShippingZone } from '@/types/shipping';
import type { ZoneExceptionFormRow } from './useZoneExceptions';
import { type ShippingZoneFormData, emptyFormData } from './useShippingZones.types';
import { ADMIN_POLL_INTERVAL_MS } from '../../lib/adminPolling';

export type { ShippingZoneFormData };

export function useShippingZones() {
  const confirm = useConfirm();
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Same split as the discounts hook: the status write and its undo together,
  // away from the list, the form and the delete flow.
  const { toggleStatus } = useShippingZoneStatus({
    refresh: () => fetchZones(),
    setPendingId,
  });

  const [formData, setFormData] = useState<ShippingZoneFormData>(emptyFormData);

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true);
    try {
      const res = await fetch('/api/admin/shipping-zones');
      const data = await res.json();
      if (data.success) setZones(data.zones);
    } catch (err) {
      if (opts.silent) console.error('Error syncing shipping zones:', err);
      else setError('Failed to load shipping zones');
    } finally {
      if (!opts.silent) setLoading(false);
    }
  };

  // Background poll — keeps the list fresh without a manual Refresh button.
  useEffect(() => {
    const interval = setInterval(() => fetchZones({ silent: true }), ADMIN_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openModal = (zone?: ShippingZone) => {
    if (zone) {
      setEditingId(zone.id);
      setFormData({
        name: zone.name,
        state: zone.state,
        lga: zone.lga || '',
        places: zone.places || '',
        delivery_fee: zone.delivery_fee.toString(),
        pickup_available: zone.pickup_available,
        pickup_address: zone.pickup_address || '',
        contact_phone: zone.contact_phone || '',
        delivery_label: zone.delivery_label,
        is_door_delivery: zone.is_door_delivery,
        delivery_eta_min: zone.delivery_eta_min.toString(),
        delivery_eta_max: zone.delivery_eta_max.toString(),
        delivery_eta_unit: zone.delivery_eta_unit,
        is_primary: zone.is_primary,
        is_active: zone.is_active,
        sort_order: zone.sort_order.toString(),
      });
    } else {
      setEditingId(null);
      setFormData(emptyFormData);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent, exceptionRows: ZoneExceptionFormRow[] = []) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const url = '/api/admin/shipping-zones';
      const method = editingId ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        id: editingId,
        lga: formData.lga || null,
        places: formData.lga && formData.places.trim() ? formData.places.trim() : null,
        delivery_fee: Number(formData.delivery_fee) || 0,
        delivery_eta_min: Number(formData.delivery_eta_min) || 1,
        delivery_eta_max: Number(formData.delivery_eta_max) || Number(formData.delivery_eta_min) || 1,
        sort_order: Number(formData.sort_order) || 0,
        exceptions: exceptionRows.map((row) => ({
          id: row.id,
          lga: row.lga || null,
          places: row.places.trim() || null,
          delivery_fee: row.delivery_fee ? Number(row.delivery_fee) : null,
          delivery_eta_min: row.delivery_eta_min ? Number(row.delivery_eta_min) : null,
          delivery_eta_max: row.delivery_eta_max ? Number(row.delivery_eta_max) : null,
          delivery_eta_unit: row.delivery_eta_unit || null,
        })),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        fetchZones();
        closeModal();
      } else {
        setError(data.error || 'Failed to save shipping zone');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const zone = zones.find((candidate) => candidate.id === id);

    const confirmed = await confirm({
      title: zone ? `Delete the ${zone.name} zone?` : 'Delete this shipping zone?',
      message: 'Checkout quotes delivery from these zones. An address with no zone cannot be quoted.',
      consequences: [
        'Customers in this zone lose their delivery option at checkout',
        'Orders already placed keep the delivery they were charged for',
        'Cannot be undone — deactivating instead keeps the rates',
      ],
      confirmLabel: 'Delete zone',
    });
    if (!confirmed) return;

    setPendingId(id);
    try {
      const res = await fetch('/api/admin/shipping-zones', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();

      if (data.success) {
        fetchZones();
      } else {
        toast.error(data.error || 'Failed to delete shipping zone');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setPendingId(null);
    }
  };

  return {
    zones, loading, error,
    isModalOpen, editingId, isSubmitting, pendingId,
    formData, setFormData,
    openModal, closeModal,
    handleSubmit, handleDelete, toggleStatus,
  };
}
