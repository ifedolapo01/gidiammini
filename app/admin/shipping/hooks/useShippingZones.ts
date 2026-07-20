/** ADMIN layer — shipping zone CRUD state: fetches zones and talks to /api/admin/shipping-zones. */
'use client';

import { useEffect, useState } from 'react';
import type { ShippingZone } from '@/types/shipping';
import type { ZoneExceptionFormRow } from './useZoneExceptions';
import { type ShippingZoneFormData, emptyFormData } from './useShippingZones.types';

export type { ShippingZoneFormData };

export function useShippingZones() {
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<ShippingZoneFormData>(emptyFormData);

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/shipping-zones');
      const data = await res.json();
      if (data.success) setZones(data.zones);
    } catch (err) {
      setError('Failed to load shipping zones');
    } finally {
      setLoading(false);
    }
  };

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
    if (!confirm('Are you sure you want to delete this shipping zone?')) return;

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
        alert(data.error || 'Failed to delete shipping zone');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const toggleStatus = async (zone: ShippingZone) => {
    try {
      const res = await fetch('/api/admin/shipping-zones', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...zone, is_active: !zone.is_active })
      });
      const data = await res.json();
      if (data.success) fetchZones();
    } catch (err) {
      alert('Failed to toggle status');
    }
  };

  return {
    zones, loading, error,
    isModalOpen, editingId, isSubmitting,
    formData, setFormData,
    openModal, closeModal,
    handleSubmit, handleDelete, toggleStatus,
  };
}
