/** ADMIN layer — depends only on Core (tokens + primitives) and Commerce. No storefront branding. */
// app/admin/settings/page.tsx — the numbers that used to need a deploy.
//
// The tax rate was a constant in lib/commerce/checkout.ts, the bank account was
// three environment variables, and "low stock" meant 5 in three places and 10
// in a fourth. All of them are one row in store_settings now, and this is where
// the person who owns the shop changes them.
//
// Owner-only to write, by the same rule as the team page: this is where the
// account customers transfer money to is set. A manager sees the values and a
// disabled form rather than no page at all, because "what is our tax rate" is a
// fair question for a manager to have and refusing the whole screen answers it
// with a 403.
'use client';

import { AlertTriangle, Save, Undo2 } from 'lucide-react';
import { Button, ErrorState } from '@/components/ui';
import { can } from '@/lib/api/admin-roles';
import { useAdminIdentity } from '../hooks/useAdminIdentity';
import { useToast } from '../hooks/useToast';
import { useStoreSettingsForm } from './hooks/useStoreSettingsForm';
import { SettingsSkeleton } from './components/SettingsSkeleton';
import {
  BankDetailsSection,
  NotificationsSection,
  OperationsSection,
  StoreIdentitySection,
  type SectionProps,
} from './components/SettingsSections';

export default function SettingsPage() {
  const { admin } = useAdminIdentity();
  const { showToast } = useToast();
  const { draft, setField, loading, saving, error, fieldErrors, dirty, save, reset } =
    useStoreSettingsForm(showToast);

  const canEdit = can(admin?.role, 'settings:write');

  if (loading) return <SettingsSkeleton />;

  if (error) {
    return (
      <ErrorState
        title="Settings could not be loaded"
        description={error}
        actions={<Button onClick={() => window.location.reload()}>Try again</Button>}
      />
    );
  }

  const sectionProps: SectionProps = { draft, setField, errors: fieldErrors };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;
    await save();
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-h4 font-bold text-text-primary">Settings</h1>
        <p className="text-text-secondary">
          Store details, bank account, tax and stock thresholds — changed here, not in code.
        </p>
      </div>

      {!canEdit && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-control border border-warning-border bg-warning-background p-3 text-body-sm text-warning"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
          These are the settings the shop is running on. Only an owner can change them.
        </p>
      )}

      {/* fieldset/disabled rather than a prop on each input: it takes every
          control in the form out of the tab order in one place, including any
          added later. */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset disabled={!canEdit || saving} className="space-y-6 disabled:opacity-70">
          <legend className="sr-only">Store settings</legend>
          <StoreIdentitySection {...sectionProps} />
          <BankDetailsSection {...sectionProps} />
          <OperationsSection {...sectionProps} />
          <NotificationsSection {...sectionProps} />
        </fieldset>

        {canEdit && (
          // Sticky, because this form is longer than a screen and a Save button
          // at the bottom of it is a Save button somebody scrolls past.
          <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur">
            <span aria-live="polite" className="mr-auto text-body-sm text-text-secondary">
              {dirty ? 'Unsaved changes' : 'All changes saved'}
            </span>
            <Button type="button" variant="secondary" onClick={reset} disabled={!dirty || saving}>
              <Undo2 size={16} />
              Discard
            </Button>
            <Button type="submit" loading={saving} disabled={!dirty}>
              <Save size={16} />
              Save settings
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
