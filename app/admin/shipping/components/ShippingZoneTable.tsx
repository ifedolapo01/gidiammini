/** ADMIN layer — shipping zones table with per-row actions. Each zone's
 * exceptions render as their own indented sub-rows directly beneath it, so an
 * admin can see every carve-out at a glance rather than hunting for
 * separately-created zones that might quietly conflict. */
'use client';

import { Fragment } from 'react';
import { MapPin, Store, Phone, Edit2, Trash2, Star } from 'lucide-react';
import { Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/commerce/pricing';
import { formatZoneEta, formatEtaRange } from '@/lib/commerce/shipping-eta';
import { formatZoneLocation } from '@/lib/commerce/shipping-match';
import type { ShippingZone, ShippingZoneException } from '@/types/shipping';

interface ShippingZoneTableProps {
  zones: ShippingZone[];
  onToggleStatus: (zone: ShippingZone) => void;
  onEdit: (zone: ShippingZone) => void;
  onDelete: (id: string) => void;
}

function ExceptionRow({ zone, exception }: { zone: ShippingZone; exception: ShippingZoneException }) {
  const effectiveLga = exception.lga || zone.lga || '';
  const places = exception.places
    ? exception.places.split(/[,\n]/).map((p) => p.trim()).filter(Boolean).join(', ')
    : '';
  const location = places ? `${effectiveLga} › ${places}` : effectiveLga;

  const fee = exception.delivery_fee != null
    ? formatCurrency(exception.delivery_fee)
    : `${formatCurrency(zone.delivery_fee)} (inherited)`;

  const eta = exception.delivery_eta_min != null && exception.delivery_eta_max != null && exception.delivery_eta_unit
    ? formatEtaRange(exception.delivery_eta_min, exception.delivery_eta_max, exception.delivery_eta_unit)
    : `${formatZoneEta(zone)} (inherited)`;

  return (
    <tr className="bg-background-secondary/40 text-body-sm">
      <td className="px-6 py-2 pl-10 text-text-secondary">↳ {location}</td>
      <td className="px-6 py-2 text-text-secondary" colSpan={3}>{fee} • {eta}</td>
      <td className="px-6 py-2">
        {!exception.is_active && (
          <Badge tone="destructive" variant="solid" className="text-caption-md">Inactive</Badge>
        )}
      </td>
      <td className="px-6 py-2" />
    </tr>
  );
}

export function ShippingZoneTable({ zones, onToggleStatus, onEdit, onDelete }: ShippingZoneTableProps) {
  return (
    <div className="bg-surface rounded-surface shadow-elevation-1 border border-border-light overflow-hidden mb-8">
      <div className="p-4 border-b border-border-light bg-background-secondary flex items-center justify-between">
        <h2 className="text-body-lg font-bold text-text-primary">Shipping Zones</h2>
        <span className="bg-primary/10 text-primary text-caption-md font-bold px-2.5 py-1 rounded-full">{zones.length}</span>
      </div>
      {zones.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <MapPin size={32} />
          </div>
          <h3 className="text-body-lg font-bold text-text-primary mb-1">No shipping zones yet</h3>
          <p className="text-text-secondary max-w-md mx-auto">
            Add a zone for each state or area you ship to — set its delivery fee, whether pickup is offered, and a contact phone number.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-background-secondary border-b border-border-light text-body-sm text-text-secondary uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Zone</th>
                <th className="px-6 py-4 font-semibold">Delivery</th>
                <th className="px-6 py-4 font-semibold">Pickup</th>
                <th className="px-6 py-4 font-semibold">Contact</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {zones.map((zone) => (
                <Fragment key={zone.id}>
                  <tr className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-text-primary">{zone.name}</p>
                        {zone.is_primary && (
                          <span title="Main location">
                            <Star size={14} className="fill-warning text-warning" />
                          </span>
                        )}
                      </div>
                      <p className="text-caption-md text-text-secondary" title={formatZoneLocation(zone)}>
                        {formatZoneLocation(zone)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-text-primary">{formatCurrency(zone.delivery_fee)}</p>
                      <p className="text-caption-md text-text-secondary">{zone.delivery_label} • {formatZoneEta(zone)}</p>
                    </td>
                    <td className="px-6 py-4">
                      {zone.pickup_available ? (
                        <div className="flex items-start gap-1.5">
                          <Store size={14} className="text-success mt-0.5 shrink-0" />
                          <span className="text-body-sm text-text-primary line-clamp-2" title={zone.pickup_address || ''}>
                            {zone.pickup_address || 'No address set'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-body-sm text-text-muted italic">Not offered</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {zone.contact_phone ? (
                        <div className="flex items-center gap-1.5 text-body-sm text-text-primary">
                          <Phone size={14} className="text-text-secondary" />
                          {zone.contact_phone}
                        </div>
                      ) : (
                        <span className="text-body-sm text-text-muted italic">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onToggleStatus(zone)}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${zone.is_active ? 'bg-success' : 'bg-disabled'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-surface transition-transform ${zone.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                        {!zone.is_active && (
                          <Badge tone="destructive" variant="solid" className="font-semibold uppercase tracking-wider">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center">
                        <button onClick={() => onEdit(zone)} className="text-text-muted hover:text-primary p-2 transition-colors" title="Edit Zone">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => onDelete(zone.id)} className="text-text-muted hover:text-destructive p-2 transition-colors" title="Delete Zone">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {(zone.shipping_zone_exceptions ?? []).map((exception) => (
                    <ExceptionRow key={exception.id} zone={zone} exception={exception} />
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
