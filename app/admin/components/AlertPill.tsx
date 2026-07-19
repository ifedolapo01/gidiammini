/**
 * ADMIN layer — presentation for a single alert pill in the marquee ticker.
 * Token-based via semantic status tones; no business branding.
 */
"use client";

import {
  AlertTriangle,
  X,
  ChevronRight,
  AlertCircle,
  ShoppingBag,
  Package,
  Bell,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AlertItem, AlertTone } from "@/app/admin/hooks/useAdminAlerts";

const toneClasses: Record<AlertTone, string> = {
  destructive: "bg-destructive-background text-destructive border-destructive-border",
  warning: "bg-warning-background text-warning border-warning-border",
  info: "bg-info-background text-info border-info-border",
  accent: "bg-accent/10 text-accent border-accent/30",
};

function getAlertIcon(type: string) {
  switch (type) {
    case "out-of-stock":
      return <AlertTriangle className="size-4 animate-pulse" />;
    case "low-stock":
      return <Package className="size-4" />;
    case "pending-orders":
      return <ShoppingBag className="size-4" />;
    case "system":
      return <Bell className="size-4" />;
    default:
      return <AlertCircle className="size-4" />;
  }
}

// Format message with count if available
function formatMessage(alert: AlertItem) {
  if (alert.count !== undefined) {
    return alert.message.replace(/\d+/, alert.count.toString());
  }
  return alert.message;
}

interface AlertPillProps {
  alert: AlertItem;
  onDismiss: (id: string) => void;
}

export function AlertPill({ alert, onDismiss }: AlertPillProps) {
  return (
    <div
      className={cn(
        "flex items-center px-4 py-1.5 mx-3 rounded-full border shadow-elevation-1",
        toneClasses[alert.tone],
      )}
    >
      <div className="mr-2">{getAlertIcon(alert.type)}</div>

      <span className="text-body-sm font-medium mr-3">{formatMessage(alert)}</span>

      <Link
        href={alert.link}
        className="flex items-center text-caption-md bg-surface/50 hover:bg-surface/80 text-text-primary px-2 py-1 rounded-control transition-colors"
      >
        View
        <ChevronRight className="size-3 ml-0.5" aria-hidden="true" />
      </Link>

      <button
        onClick={() => onDismiss(alert.id)}
        className="ml-2 p-1 hover:bg-text-primary/5 rounded-full transition-colors opacity-60 hover:opacity-100"
        aria-label="Dismiss alert"
      >
        <X className="size-3" aria-hidden="true" />
      </button>

      {/* Separator */}
      <div className="ml-6 w-1 h-1 rounded-full bg-border-strong" />
    </div>
  );
}
