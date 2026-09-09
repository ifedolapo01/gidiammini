// app/api/admin/search/route.ts - the zero-result list, and the synonyms that fix it.
//
// GET: what people searched for and found nothing (zero_result_searches), plus
// every synonym already on file. POST adds one term -> expansion pair; DELETE
// removes one. All three run through build_search_tsquery(), so a synonym
// added here fixes the header typeahead and the /search results page at once.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { normaliseSearchQuery } from '@/lib/commerce/search-query';

/** A long tail of one-off typos is not worth scrolling through; the busiest
 *  unaddressed terms are what a synonym should go on next. */
const ZERO_RESULT_LIMIT = 30;

interface ZeroResultRow {
  query: string;
  times_searched: number;
  last_searched_at: string;
  has_synonym: boolean;
}

interface SynonymRow {
  id: string;
  term: string;
  expansion: string;
  created_at: string;
}

export const GET = withAdminAuth(async (_request, { supabase }) => {
  const [zeroResultResult, synonymResult] = await Promise.all([
    supabase
      .from('zero_result_searches')
      .select('query, times_searched, last_searched_at, has_synonym')
      .order('times_searched', { ascending: false })
      .order('last_searched_at', { ascending: false })
      .limit(ZERO_RESULT_LIMIT),
    supabase
      .from('search_synonyms')
      .select('id, term, expansion, created_at')
      .order('created_at', { ascending: false }),
  ]);

  if (zeroResultResult.error) {
    console.error('Zero-result search lookup failed:', zeroResultResult.error.message);
    return NextResponse.json({ success: false, error: 'Could not load zero-result searches' }, { status: 500 });
  }
  if (synonymResult.error) {
    console.error('Synonym lookup failed:', synonymResult.error.message);
    return NextResponse.json({ success: false, error: 'Could not load synonyms' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    zeroResults: (zeroResultResult.data ?? []) as ZeroResultRow[],
    synonyms: (synonymResult.data ?? []) as SynonymRow[],
  });
});

export const POST = withAdminAuth(async (request, { supabase, audit }) => {
  const body = await request.json().catch(() => null);
  const term = normaliseSearchQuery(body?.term);
  // The expansion keeps its own words apart (only alnum-filtered at query time
  // by build_search_tsquery), but still needs the same "is this blank" check.
  const expansion = typeof body?.expansion === 'string' ? body.expansion.trim() : '';

  if (!term || !expansion) {
    return NextResponse.json(
      { success: false, error: 'Both a term and an expansion are required.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('search_synonyms')
    .insert({ term, expansion })
    .select('id, term, expansion, created_at')
    .single();

  if (error) {
    // The unique constraint is the one error worth naming — everything else is
    // a generic failure.
    const message = error.code === '23505' ? 'That synonym already exists.' : 'Could not save the synonym.';
    return NextResponse.json({ success: false, error: message }, { status: error.code === '23505' ? 409 : 500 });
  }

  audit({ entityType: 'search_synonym', entityId: data.id, action: 'create', after: data });

  return NextResponse.json({ success: true, synonym: data as SynonymRow });
});

export const DELETE = withAdminAuth(async (request, { supabase, audit }) => {
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';

  if (!id) {
    return NextResponse.json({ success: false, error: 'A synonym id is required.' }, { status: 400 });
  }

  const { error } = await supabase.from('search_synonyms').delete().eq('id', id);

  if (error) {
    console.error('Synonym delete failed:', error.message);
    return NextResponse.json({ success: false, error: 'Could not delete the synonym.' }, { status: 500 });
  }

  audit({ entityType: 'search_synonym', entityId: id, action: 'delete' });

  return NextResponse.json({ success: true });
});
