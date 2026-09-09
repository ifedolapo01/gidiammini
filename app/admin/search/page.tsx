/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
'use client';

import { useSearchSynonyms } from './hooks/useSearchSynonyms';
import { ZeroResultList } from './components/ZeroResultList';
import { SynonymList } from './components/SynonymList';

export default function AdminSearchPage() {
  const { zeroResults, synonyms, loading, error, savingTerm, deletingId, addSynonym, deleteSynonym } =
    useSearchSynonyms();

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
      <div>
        <h1 className="text-h4 font-bold text-text-primary">Search</h1>
        <p className="text-text-secondary">
          What shoppers search for, and the words that teach the catalogue to understand them.
        </p>
      </div>

      {loading && <p className="text-body-sm text-text-secondary">Loading…</p>}

      {!loading && error && (
        <p role="alert" className="text-body-sm text-destructive">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <ZeroResultList queries={zeroResults} savingTerm={savingTerm} onAddSynonym={addSynonym} />
          <SynonymList synonyms={synonyms} deletingId={deletingId} onDelete={deleteSynonym} />
        </>
      )}
    </div>
  );
}
