/** ADMIN layer — the synonyms already on file, editable in one place. */
'use client';

import { Trash2 } from 'lucide-react';
import { useConfirm } from '@/components/ui';
import type { Synonym } from '../hooks/useSearchSynonyms';

interface SynonymListProps {
  synonyms: Synonym[];
  deletingId: string | null;
  onDelete: (id: string) => void;
}

export function SynonymList({ synonyms, deletingId, onDelete }: SynonymListProps) {
  const confirm = useConfirm();

  const handleDelete = async (synonym: Synonym) => {
    const confirmed = await confirm({
      title: `Remove "${synonym.term}" -> "${synonym.expansion}"?`,
      consequences: [`Searching "${synonym.term}" stops also matching "${synonym.expansion}"`],
      confirmLabel: 'Remove synonym',
    });
    if (confirmed) onDelete(synonym.id);
  };

  return (
    <div className="bg-surface p-6 rounded-surface shadow-elevation-1 border border-border">
      <h2 className="text-h5 font-bold text-text-primary">Synonyms</h2>
      <p className="text-body-sm text-text-secondary mt-0.5 mb-4">
        Every one of these also expands the header search and the results page.
      </p>

      {synonyms.length === 0 ? (
        <p className="text-body-sm text-text-secondary py-4">No synonyms yet.</p>
      ) : (
        <ul className="divide-y divide-divider">
          {synonyms.map((synonym) => (
            <li key={synonym.id} className="py-3 flex items-center justify-between gap-3">
              <p className="text-text-primary min-w-0 truncate">
                <span className="font-medium">{synonym.term}</span>
                <span className="text-text-secondary"> → </span>
                <span>{synonym.expansion}</span>
              </p>
              <button
                type="button"
                onClick={() => handleDelete(synonym)}
                disabled={deletingId === synonym.id}
                aria-label={`Remove synonym: ${synonym.term} to ${synonym.expansion}`}
                className="p-2 rounded-control text-text-secondary hover:bg-surface-hover hover:text-destructive disabled:opacity-50 shrink-0"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
