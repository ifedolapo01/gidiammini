/**
 * The store settings, read and written.
 *
 * GET is deliberately wider than PUT. Several admin screens need to agree with
 * the storefront about the tax rate and the low-stock threshold — the order
 * editor's preview total, the stock page's filter — so any admin who can see
 * those screens can read the row. Changing it is another matter: this is where
 * the bank account customers transfer money to is set, and a wrong value there
 * sends the shop's takings to somebody else. See admin-route-permissions.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, type AdminRouteContext } from '@/lib/api/with-admin-auth';
import { parseJsonBody } from '@/lib/api/parse-body';
import { storeSettingsSchema } from '@/lib/api/schemas/store-settings';
import { diffForAudit, isEmptyDiff } from '@/lib/api/audit';
import { settingsFromRow, settingsToRow } from '@/lib/commerce/store-settings';
import { readStoreSettings, revalidateStoreSettings } from '@/lib/commerce/store-settings-server';

async function getSettings({ supabase }: AdminRouteContext) {
  const settings = await readStoreSettings(supabase);
  return NextResponse.json({ success: true, settings });
}

async function putSettings(request: NextRequest, { supabase, actor, audit }: AdminRouteContext) {
  const parsed = await parseJsonBody(request, storeSettingsSchema);
  if (!parsed.ok) return parsed.response;

  const before = await readStoreSettings(supabase);

  // Upsert rather than update: a database whose migration inserted the row has
  // one to update, and one that somehow does not should be given a row rather
  // than silently accepting a save that changed nothing. The id is fixed at 1
  // by the table's own CHECK, so this cannot create a second.
  const { data, error } = await supabase
    .from('store_settings')
    .upsert(
      {
        id: 1,
        ...settingsToRow(parsed.data),
        updated_at: new Date().toISOString(),
        updated_by: actor.id,
      },
      { onConflict: 'id' }
    )
    .select('*')
    .single();

  if (error) {
    // The CHECK constraints are the backstop behind the request schema, so
    // reaching one means either a value the schema does not police or a
    // direct-to-database change. Either way it is the submitted value that is
    // wrong, not the server.
    console.error('Error saving store settings:', error);
    return NextResponse.json(
      { success: false, error: 'That settings change was refused. Please check the values and try again.' },
      { status: 400 }
    );
  }

  const after = settingsFromRow(data);

  // Diffed in row shape, not in the camelCase view of it: every other entry in
  // audit_log names database columns, and an activity feed that says
  // `bank_account_number` for one entity and `bankAccountNumber` for another is
  // harder to read and harder to search. settingsToRow also drops updated_at
  // and updated_by, which move on every save and would otherwise make an
  // unchanged form look like an edit.
  const diff = diffForAudit(settingsToRow(before), settingsToRow(after));
  if (!isEmptyDiff(diff)) {
    audit({ entityType: 'store_settings', entityId: '1', action: 'update', ...diff });
  }

  // The storefront reads these through a cache keyed on a tag. Without this
  // the shop keeps quoting the old tax rate and the old account number for up
  // to an hour, which reads as a save that did not work.
  revalidateStoreSettings();

  return NextResponse.json({ success: true, settings: after });
}

export const GET = withAdminAuth((_request, ctx) => getSettings(ctx));
export const PUT = withAdminAuth((request, ctx) => putSettings(request, ctx));
