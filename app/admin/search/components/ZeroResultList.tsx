/** ADMIN layer — what people searched for and found nothing, one fix away. */
'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import type { ZeroResultQuery } from '../hooks/useSearchSynonyms';

interface ZeroResultListProps {
  queries: ZeroResultQuery[];
  savingTerm: string | null;
  onAddSynonym: (term: string, expansion: string) => Promise<boolean>;
}

export function ZeroResultList({ queries, savingTerm, onAddSynonym }: ZeroResultListProps) {
  if (queries.length === 0) {
    return (
      <div className="bg-surface p-6 rounded-surface shadow-elevation-1 border border-border">
        <h2 className="text-h5 font-bold text-text-primary">Zero-result searches</h2>
        <p className="mt-2 text-body-sm text-text-secondary">
          Nobody has searched for something the catalogue could not answer recently.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface p-6 rounded-surface shadow-elevation-1 border border-border">
      <div className="mb-4">
        <h2 className="text-h5 font-bold text-text-primary">Zero-result searches</h2>
        <p className="text-body-sm text-text-secondary mt-0.5">
          What shoppers typed and the catalogue matched to nothing. Add the word it should have
          matched instead.
        </p>
      </div>

      <ul className="divide-y divide-divider">
        {queries.map((entry) => (
          <ZeroResultRow
            key={entry.query}
            entry={entry}
            saving={savingTerm === entry.query}
            onAddSynonym={onAddSynonym}
          />
        ))}
      </ul>
    </div>
  );
}

function ZeroResultRow({
  entry,
  saving,
  onAddSynonym,
}: {
  entry: ZeroResultQuery;
  saving: boolean;
  onAddSynonym: (term: string, expansion: string) => Promise<boolean>;
}) {
  const [expansion, setExpansion] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expansion.trim()) return;
    const ok = await onAddSynonym(entry.query, expansion.trim());
    if (ok) setExpansion('');
  };

  return (
    <li className="py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium text-text-primary">
          “{entry.query}”
          {entry.hasSynonym && (
            <span className="ml-2 text-caption-md font-normal text-success">Synonym added</span>
          )}
        </p>
        <p className="text-body-sm text-text-secondary">
          Searched {entry.timesSearched} time{entry.timesSearched === 1 ? '' : 's'}, last on{' '}
          {new Date(entry.lastSearchedAt).toLocaleDateString()}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 shrink-0">
        <Input
          value={expansion}
          onChange={(e) => setExpansion(e.target.value)}
          placeholder="What the catalogue calls it"
          className="w-48"
          aria-label={`What "${entry.query}" should also match`}
        />
        <Button type="submit" size="sm" variant="outline" disabled={saving || !expansion.trim()}>
          {saving ? 'Saving…' : 'Add synonym'}
        </Button>
      </form>
    </li>
  );
}
