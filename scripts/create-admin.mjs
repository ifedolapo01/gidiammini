/**
 * Creates or updates an admin.
 *
 * Admins are Supabase Auth users allowlisted in public.admin_users. There is no
 * self-service sign-up and no public route that creates one — an admin account
 * is created here, with the service-role key, or not at all.
 *
 * Usage:
 *   node scripts/create-admin.mjs <email> <password> [--name "Ada Lovelace"] [--role owner|staff]
 *   npm run admin:create -- <email> <password> --name "Ada Lovelace"
 *
 * Idempotent. Run it again for an existing address to reset that admin's
 * password, name or role rather than creating a duplicate.
 *
 * Deactivating instead of deleting:
 *   node scripts/create-admin.mjs <email> --deactivate
 * which keeps the row so audit_log.actor_id still resolves to a person.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'], quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.');
  process.exit(1);
}

const argv = process.argv.slice(2);

/** `--name "Ada Lovelace"` takes a value; `--deactivate` does not. */
const VALUE_FLAGS = new Set(['name', 'role']);

const flags = {};
const positional = [];

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];

  if (!arg.startsWith('--')) {
    positional.push(arg);
    continue;
  }

  const key = arg.slice(2);
  if (VALUE_FLAGS.has(key)) {
    flags[key] = argv[++i];
  } else {
    flags[key] = true;
  }
}

const email = (positional[0] ?? '').trim().toLowerCase();
const deactivate = flags.deactivate === true;
const password = deactivate ? null : positional[1];
const name = typeof flags.name === 'string' ? flags.name : null;
const role = typeof flags.role === 'string' ? flags.role : 'owner';

if (!email || (!deactivate && !password)) {
  console.error('Usage: node scripts/create-admin.mjs <email> <password> [--name "Full Name"] [--role owner|staff]');
  console.error('       node scripts/create-admin.mjs <email> --deactivate');
  process.exit(1);
}

if (!['owner', 'staff'].includes(role)) {
  console.error(`--role must be "owner" or "staff", not "${role}".`);
  process.exit(1);
}

if (!deactivate && password.length < 12) {
  // Supabase's own minimum is lower. This is the only credential standing in
  // front of every order in the shop.
  console.error('Choose a password of at least 12 characters.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** listUsers is paginated, and there is no get-by-email. */
async function findAuthUser(address) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Could not list users: ${error.message}`);

    const match = data.users.find((user) => (user.email ?? '').toLowerCase() === address);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

const existing = await findAuthUser(email);

if (deactivate) {
  if (!existing) {
    console.error(`No account for ${email}.`);
    process.exit(1);
  }

  const { error } = await supabase
    .from('admin_users')
    .update({ is_active: false })
    .eq('user_id', existing.id);

  if (error) {
    console.error(`Could not deactivate: ${error.message}`);
    process.exit(1);
  }

  console.log(`Deactivated ${email}. The row is kept so past actions still resolve to them.`);
  console.log('Their existing session stops working on the next request — is_active_admin() is checked live.');
  process.exit(0);
}

let userId = existing?.id;

if (existing) {
  // app_metadata.admin is what middleware reads to gate the admin pages
  // cheaply; admin_users below is the authority.
  const { error } = await supabase.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    app_metadata: { ...(existing.app_metadata ?? {}), admin: true },
  });

  if (error) {
    console.error(`Could not update the account: ${error.message}`);
    process.exit(1);
  }

  console.log(`Updated the Supabase Auth account for ${email}.`);
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    // No confirmation mail: an admin account is provisioned deliberately by
    // somebody who already holds the service-role key.
    email_confirm: true,
    app_metadata: { admin: true },
  });

  if (error) {
    console.error(`Could not create the account: ${error.message}`);
    process.exit(1);
  }

  userId = data.user.id;
  console.log(`Created a Supabase Auth account for ${email}.`);
}

const { error: allowlistError } = await supabase
  .from('admin_users')
  .upsert(
    { user_id: userId, email, name: name ?? null, role, is_active: true },
    { onConflict: 'user_id' }
  );

if (allowlistError) {
  console.error(`Account exists but the allowlist row failed: ${allowlistError.message}`);
  console.error('Has 20260905140000_admin_users.sql been applied? Run: npm run db:push');
  process.exit(1);
}

console.log(`${email} is an active admin (${role})${name ? ` — ${name}` : ''}.`);
console.log('Sign in at /admin/login.');
