/**
 * What the ledger says about the variants currently on screen.
 *
 * GET, with the ids comma-separated in the query string.
 *
 * POST would read more naturally for a request carrying fifty uuids, and is
 * wrong here: withAdminAuth treats every POST as a mutation, so it would write
 * an audit_log row and drop the storefront's product cache on each poll of the
 * Stock page. A read that fills the activity feed with itself and evicts the
 * shop's cache every minute is not a read. Capped at a screenful of ids, which
 * keeps the URL well inside what any proxy will carry.
 *
 * Behind store:read, like the stock table it decorates — the same numbers,
 * read a different way.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth, type AdminRouteContext } from '@/lib/api/with-admin-auth';
import { readStoreSettings } from '@/lib/commerce/store-settings-server';
import { DEFAULT_WINDOW_DAYS, fetchVariantFacts } from '@/lib/commerce/inventory-query';
import { variantInsight } from '@/lib/commerce/inventory-analytics';

export const dynamic = 'force-dynamic';

/** Two screenfuls. More than this is a caller that should be paginating, and
 *  at 37 characters an id it is also where the URL stops being sensible. */
const MAX_VARIANTS = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getInsights(request: NextRequest, { supabase }: AdminRouteContext) {
  const url = new URL(request.url);

  // Filtered rather than validated-and-refused: a row built from the legacy
  // pricing_config maps carries no variant id, and those arrive empty.
  // Dropping them decorates the rows that can be, which beats a 400 that
  // blanks the column for the whole page.
  const variantIds = [
    ...new Set(
      (url.searchParams.get('variantIds') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => UUID.test(id))
    ),
  ].slice(0, MAX_VARIANTS);

  if (variantIds.length === 0) {
    return NextResponse.json({ success: true, insights: [], observedDays: 0 });
  }

  const requested = Number(url.searchParams.get('windowDays'));
  const windowDays = Number.isFinite(requested)
    ? Math.min(365, Math.max(7, Math.round(requested)))
    : DEFAULT_WINDOW_DAYS;

  const [settings, facts] = await Promise.all([
    readStoreSettings(supabase),
    fetchVariantFacts(supabase, variantIds, windowDays),
  ]);

  const policy = { leadDays: settings.reorderLeadDays, coverDays: settings.reorderCoverDays };

  return NextResponse.json({
    success: true,
    insights: facts.map((fact) => variantInsight(fact, policy)),
    windowDays,
    // The same for every row, but returned once at the top so the page can
    // caveat the whole table rather than repeating "based on 4 days" in fifty
    // cells.
    observedDays: facts[0]?.observedDays ?? 0,
    policy,
  });
}

export const GET = withAdminAuth(getInsights);
