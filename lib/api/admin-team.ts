/**
 * CORE layer — reading and changing who the admins are.
 *
 * Kept out of the route so the rules that matter — an address can only hold
 * one admin account, and the store can never be left without an owner — are
 * stated once and are testable without a request.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { AdminRole } from './admin-roles';

export interface TeamMember {
  user_id: string;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean;
  last_seen_at: string | null;
  invited_at: string | null;
  created_at: string;
  /** Invited, never signed in. The team list says "Invitation pending" rather
   * than showing them as a working colleague. */
  pending: boolean;
}

const COLUMNS = 'user_id, email, name, role, is_active, last_seen_at, invited_at, created_at';

/** A failure a caller should show to the operator, as distinct from a bug. */
export class TeamError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message);
    this.name = 'TeamError';
  }
}

type Client = SupabaseClient<Database>;

/** Everyone, active first, then most recently added. */
export async function listTeam(supabase: Client): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('admin_users')
    .select(COLUMNS)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new TeamError(`Could not load the team: ${error.message}`, 500);

  return (data ?? []).map((row) => ({
    ...row,
    pending: row.last_seen_at === null && row.invited_at !== null,
  }));
}

/** One member, or null. */
export async function findMember(supabase: Client, userId: string): Promise<TeamMember | null> {
  const { data, error } = await supabase
    .from('admin_users')
    .select(COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new TeamError(`Could not read that admin: ${error.message}`, 500);
  if (!data) return null;

  return { ...data, pending: data.last_seen_at === null && data.invited_at !== null };
}

/** The row for an address, whether active or not — a revoked colleague coming
 * back is a reactivation, not a second account. */
export async function findMemberByEmail(supabase: Client, email: string): Promise<TeamMember | null> {
  const { data, error } = await supabase
    .from('admin_users')
    .select(COLUMNS)
    .ilike('email', email)
    .maybeSingle();

  if (error) throw new TeamError(`Could not check that address: ${error.message}`, 500);
  if (!data) return null;

  return { ...data, pending: data.last_seen_at === null && data.invited_at !== null };
}

/**
 * Refuses a change that would leave nobody able to manage admins.
 *
 * The realistic accident is an owner demoting or deactivating themselves while
 * tidying up, which cannot be undone from inside the product — recovering
 * needs the service-role key and a terminal. Cheaper to refuse.
 */
async function assertOwnerRemains(
  supabase: Client,
  userId: string,
  next: { role?: AdminRole; is_active?: boolean }
): Promise<void> {
  const current = await findMember(supabase, userId);
  if (!current || current.role !== 'owner' || !current.is_active) return;

  const staysOwner = (next.role ?? current.role) === 'owner';
  const staysActive = next.is_active ?? current.is_active;
  if (staysOwner && staysActive) return;

  const { count, error } = await supabase
    .from('admin_users')
    .select('user_id', { count: 'exact', head: true })
    .eq('role', 'owner')
    .eq('is_active', true);

  if (error) throw new TeamError(`Could not verify the owner list: ${error.message}`, 500);

  if ((count ?? 0) <= 1) {
    throw new TeamError(
      'This is the only active owner. Make somebody else an owner first, then change this account.'
    );
  }
}

/** Records an invited admin. The auth user is created by admin-invite.ts. */
export async function addMember(
  supabase: Client,
  member: { userId: string; email: string; name: string | null; role: AdminRole; invitedBy: string }
): Promise<TeamMember> {
  const { error } = await supabase.from('admin_users').upsert(
    {
      user_id: member.userId,
      email: member.email,
      name: member.name,
      role: member.role,
      is_active: true,
      invited_at: new Date().toISOString(),
      invited_by: member.invitedBy,
      deactivated_at: null,
    },
    { onConflict: 'user_id' }
  );

  if (error) throw new TeamError(`Could not save the admin: ${error.message}`, 500);

  const saved = await findMember(supabase, member.userId);
  if (!saved) throw new TeamError('The admin was saved but could not be read back.', 500);
  return saved;
}

/**
 * Changes a role, revokes access, or restores it.
 *
 * Revocation clears the `admin` claim as well as the row. The row is what
 * every API request is checked against and takes effect immediately; the claim
 * is what middleware reads, and clearing it stops a revoked admin from loading
 * admin pages once their token next refreshes. Neither alone is enough.
 */
export async function updateMember(
  supabase: Client,
  userId: string,
  changes: { role?: AdminRole; is_active?: boolean; name?: string | null }
): Promise<TeamMember> {
  await assertOwnerRemains(supabase, userId, changes);

  const patch: Database['public']['Tables']['admin_users']['Update'] = { ...changes };

  if (changes.is_active === false) patch.deactivated_at = new Date().toISOString();
  if (changes.is_active === true) patch.deactivated_at = null;

  const { error } = await supabase.from('admin_users').update(patch).eq('user_id', userId);
  if (error) throw new TeamError(`Could not update the admin: ${error.message}`, 500);

  if (changes.is_active !== undefined) {
    const { error: claimError } = await supabase.auth.admin.updateUserById(userId, {
      app_metadata: { admin: changes.is_active },
    });
    // Not fatal: the allowlist row is the authority, and it has already been
    // written. A stale claim lets them load a page that will refuse every
    // action on it.
    if (claimError) console.error(`Could not sync the admin claim: ${claimError.message}`);
  }

  const saved = await findMember(supabase, userId);
  if (!saved) throw new TeamError('That admin no longer exists.', 404);
  return saved;
}
