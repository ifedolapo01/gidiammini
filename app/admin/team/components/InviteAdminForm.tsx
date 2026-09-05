/** ADMIN layer — inviting somebody, in a dialog.
 *
 * Deliberately three fields. Anything else an admin account needs — their
 * password, their name as they prefer to spell it — belongs to the person
 * being invited, not to the owner inviting them.
 */
'use client';

import { useState } from 'react';
import { Button, Input, Modal } from '@/components/ui';
import { DEFAULT_ADMIN_ROLE, type AdminRole } from '@/lib/api/admin-roles';
import RoleSelect from './RoleSelect';
import type { InviteInput } from '../hooks/useTeam';

interface InviteAdminFormProps {
  open: boolean;
  onClose: () => void;
  onInvite: (input: InviteInput) => Promise<{ ok: boolean }>;
  submitting: boolean;
}

export default function InviteAdminForm({ open, onClose, onInvite, submitting }: InviteAdminFormProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  // Least privilege by default: raising somebody's access is a deliberate act,
  // and a mis-clicked invitation should not be able to hand out the shop.
  const [role, setRole] = useState<AdminRole>(DEFAULT_ADMIN_ROLE);

  function reset() {
    setEmail('');
    setName('');
    setRole(DEFAULT_ADMIN_ROLE);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const result = await onInvite({ email: email.trim(), name: name.trim(), role });
    if (result.ok) {
      reset();
      onClose();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite an admin" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="invite-email" className="mb-1 block text-body-sm font-medium text-text-primary">
            Email address
          </label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="colleague@example.com"
            autoComplete="off"
            aria-describedby="invite-email-hint"
            required
          />
          <p id="invite-email-hint" className="mt-1 text-caption-md text-text-secondary">
            They receive a link to set their own password. Nobody else ever sees it.
          </p>
        </div>

        <div>
          <label htmlFor="invite-name" className="mb-1 block text-body-sm font-medium text-text-primary">
            Name <span className="font-normal text-text-secondary">(optional)</span>
          </label>
          <Input
            id="invite-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ada Lovelace"
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="invite-role" className="mb-1 block text-body-sm font-medium text-text-primary">
            Role
          </label>
          <RoleSelect id="invite-role" value={role} onChange={setRole} />
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} disabled={!email.trim()}>
            {submitting ? 'Sending invitation…' : 'Send invitation'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
