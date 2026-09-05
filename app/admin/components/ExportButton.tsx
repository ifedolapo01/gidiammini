/** ADMIN layer — downloads one dataset as a CSV.
 *
 * Fetched as a blob rather than by navigating to the URL. Navigation would be
 * one line, but it gives no way to show that anything is happening while the
 * server pages through 40,000 rows, no way to report a failure other than
 * dumping JSON into a new tab, and no way to notice the truncation header. A
 * button that silently does nothing for ten seconds is a button people press
 * four times.
 */
'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui';

interface ExportButtonProps {
  dataset: 'orders' | 'products' | 'stock' | 'customers';
  label?: string;
  /** Extra query parameters, e.g. a date range for orders. */
  params?: Record<string, string | undefined>;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Hands the blob to the browser as a download and cleans up after itself. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** The server names the file in Content-Disposition; this is the fallback. */
function filenameFrom(header: string | null, dataset: string): string {
  const match = header?.match(/filename="([^"]+)"/);
  return match?.[1] ?? `${dataset}.csv`;
}

export default function ExportButton({
  dataset,
  label = 'Export CSV',
  params,
  variant = 'outline',
  size = 'sm',
}: ExportButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);

    try {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(params ?? {})) {
        if (value) query.set(key, value);
      }

      const suffix = query.toString();
      const response = await fetch(`/api/admin/export/${dataset}${suffix ? `?${suffix}` : ''}`);

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || `Export failed (${response.status})`);
      }

      const blob = await response.blob();
      saveBlob(blob, filenameFrom(response.headers.get('Content-Disposition'), dataset));

      // The file opens and looks complete either way, so a partial one has to
      // say so out loud.
      if (response.headers.get('X-Export-Truncated') === 'true') {
        toast.warning(
          'This export hit the row limit and is incomplete. Narrow it with a date range.'
        );
      } else {
        toast.success(`${dataset} exported.`);
      }
    } catch (error: any) {
      console.error(`Export of ${dataset} failed:`, error);
      toast.error(error.message || 'Could not download the export.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button variant={variant} size={size} loading={downloading} onClick={download}>
      {!downloading && <Download className="w-4 h-4" />}
      {label}
    </Button>
  );
}
