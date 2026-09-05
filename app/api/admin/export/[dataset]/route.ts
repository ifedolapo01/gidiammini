// app/api/admin/export/[dataset]/route.ts - the download behind every Export
// button.
//
// One route for all four datasets rather than four near-identical files: they
// differ only in which rows and columns they ask for, and that difference
// lives in lib/commerce/export-datasets.ts.
//
// Returns a file rather than JSON, so it is reached by navigating to the URL
// rather than by fetch(). That is also why it is a GET: a browser download
// cannot carry a request body, and the session cookie travels with the
// navigation exactly as it does for any other admin request.
//
// AND IT IS AUDITED. withAdminAuth only records mutating methods, on the
// reasoning that a read changes nothing — but an export is not an ordinary
// read. "Every customer's name, email, phone and address left the building"
// is exactly the event somebody asks about afterwards, so this route records
// its own entry.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { recordAudit } from '@/lib/api/audit';
import { clientIdentifier } from '@/lib/api/rate-limit';
import { csvFilename, csvHeaders, toCsv } from '@/lib/commerce/csv';
import {
  buildDataset,
  EXPORT_DATASETS,
  type ExportDataset,
} from '@/lib/commerce/export-datasets';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** An ISO date the caller supplied, or undefined. Rejects junk rather than
 * passing it to Postgres and getting a 500. */
function isoDate(value: string | null): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export const GET = withAdminAuth(async (request, { supabase, params, actor }) => {
  const { dataset } = await params;

  if (!(EXPORT_DATASETS as readonly string[]).includes(dataset)) {
    return NextResponse.json(
      { success: false, error: `Unknown export. Choose one of: ${EXPORT_DATASETS.join(', ')}` },
      { status: 404 }
    );
  }

  const url = new URL(request.url);
  const range = {
    from: isoDate(url.searchParams.get('from')),
    to: isoDate(url.searchParams.get('to')),
  };

  try {
    const result = await buildDataset(supabase, dataset as ExportDataset, range);
    const csv = toCsv(result.rows, result.columns);

    await recordAudit(
      supabase,
      {
        entityType: 'request',
        entityId: dataset,
        action: 'export',
        after: { dataset, rows: result.rows.length, truncated: result.truncated, ...range },
      },
      {
        actorId: actor.id,
        actorEmail: actor.email,
        method: 'GET',
        path: url.pathname,
        ip: clientIdentifier(request),
        statusCode: 200,
      }
    );

    const headers = csvHeaders(csvFilename(dataset));

    // A silently truncated export is the one failure that matters here, since
    // the file still opens and still looks complete. The header is read by the
    // Export button, which warns rather than letting it pass unnoticed.
    if (result.truncated) headers['X-Export-Truncated'] = 'true';

    return new NextResponse(csv, { headers });
  } catch (error: any) {
    console.error(`Export of ${dataset} failed:`, error);
    return NextResponse.json(
      { success: false, error: 'Could not build the export. Please try again.' },
      { status: 500 }
    );
  }
});
