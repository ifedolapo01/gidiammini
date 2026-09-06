/** ADMIN layer — the Settings form's state, and saving it.
 *
 * The form edits strings, not the settings. Every numeric field on this page
 * is a text input an owner is halfway through typing, and a draft that stores
 * `taxRate: number` has to decide what "" and "7." mean on every keystroke —
 * usually by turning them into 0 and deleting what the person was typing. So
 * the draft is text throughout and is converted once, on submit, where a value
 * that will not parse becomes a field error instead of a silent zero.
 *
 * The server is the authority for what was saved: the response body is the
 * stored row, and the draft is re-seeded from it rather than from what was
 * submitted. That is what makes a normalisation the server applied — a
 * lower-cased prefix, a trimmed name — visible instead of only happening.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FieldErrors } from '@/lib/api/field-errors';
import type { StoreSettings } from '@/types/settings';
import { DEFAULT_STORE_SETTINGS } from '@/lib/commerce/store-settings';
import { invalidateAdminStoreSettings } from '../../hooks/useAdminStoreSettings';
import { type SettingsDraft, toDraft, toPayload } from './settings-draft';

export type { SettingsDraft };

interface UseStoreSettingsForm {
  draft: SettingsDraft;
  setField: <K extends keyof SettingsDraft>(field: K, value: SettingsDraft[K]) => void;
  loading: boolean;
  saving: boolean;
  /** Whole-page failure — the settings could not be read at all. */
  error: string | null;
  fieldErrors: FieldErrors;
  dirty: boolean;
  save: () => Promise<boolean>;
  reset: () => void;
}

export function useStoreSettingsForm(showToast: (m: string, t?: 'success' | 'error') => void): UseStoreSettingsForm {
  const [saved, setSaved] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [draft, setDraft] = useState<SettingsDraft>(() => toDraft(DEFAULT_STORE_SETTINGS));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await fetch('/api/admin/settings');
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || 'Failed to load settings');
        if (!active) return;
        setSaved(data.settings);
        setDraft(toDraft(data.settings));
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const setField = useCallback(<K extends keyof SettingsDraft>(field: K, value: SettingsDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    // The message under a field goes the moment that field is touched. Leaving
    // it until the next submit means an owner fixes the value and is still
    // being told it is wrong.
    setFieldErrors((current) => {
      if (!(field in current)) return current;
      const { [field as string]: _removed, ...rest } = current;
      return rest;
    });
  }, []);

  const reset = useCallback(() => {
    setDraft(toDraft(saved));
    setFieldErrors({});
  }, [saved]);

  const save = useCallback(async (): Promise<boolean> => {
    const payload = toPayload(draft);
    if (!payload.ok) {
      setFieldErrors(payload.fieldErrors);
      showToast('Some settings could not be saved. Check the highlighted fields.', 'error');
      return false;
    }

    setSaving(true);
    setFieldErrors({});

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload.data),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (data?.fieldErrors) setFieldErrors(data.fieldErrors);
        showToast(data?.error || 'Could not save settings.', 'error');
        return false;
      }

      setSaved(data.settings);
      setDraft(toDraft(data.settings));
      // Other admin screens hold these values behind a shared cache — the
      // order editor's tax preview among them. Without this they keep the old
      // rate until the tab is reloaded.
      invalidateAdminStoreSettings();
      showToast('Settings saved.');
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save settings.', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  }, [draft, showToast]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(saved));

  return { draft, setField, loading, saving, error, fieldErrors, dirty, save, reset };
}
