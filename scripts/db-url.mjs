/**
 * The pooler connection string every migration command needs, validated once.
 *
 * Supabase made the direct database host (db.<ref>.supabase.co) IPv6-only, and
 * IPv4 on it is a paid add-on. On a network that hands out an IPv6 address but
 * routes nothing over it — most Nigerian mobile broadband — every CLI command
 * that opens a Postgres connection fails with "Connection terminated
 * unexpectedly", which reads like a database fault and is a network one.
 *
 * The Supavisor pooler has IPv4, so `db push` and `migration list` are both
 * given --db-url pointing at it. That URL carries the database password, so it
 * lives in .env.local (gitignored) and is never echoed or passed on a command
 * line a shell would remember.
 */
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';

// .env.local first, the way Next resolves it; neither file is required.
dotenv.config({ path: ['.env.local', '.env'], quiet: true });

const SETUP = `Get it from the Supabase dashboard:
  Project → Connect → "Session pooler"   (NOT "Direct connection")

It looks like this — port 5432, host ends in .pooler.supabase.com, and the
user is postgres.<project-ref>:

  postgresql://postgres.<ref>:<db-password>@aws-1-<region>.pooler.supabase.com:5432/postgres

Put it in .env.local (which is gitignored):

  SUPABASE_DB_URL="postgresql://..."

If the password contains @ # ? / or :, percent-encode it (@ becomes %40).
The database password is not your account password and not the service role
key; reset it under Project Settings → Database if you do not have it.`;

/** Host and port only — the rest of the URL is a credential. */
export function describe(connectionString) {
  try {
    const parsed = new URL(connectionString);
    return `${parsed.hostname}:${parsed.port || '5432'}`;
  } catch {
    return 'an unparseable URL';
  }
}

/**
 * The validated URL, or a clear explanation and a non-zero exit.
 *
 * Both rejections below are configurations that otherwise fail with something
 * that does not say what is wrong: the direct host times out, and the
 * transaction pooler accepts the connection and then refuses the migration.
 */
export function requireDbUrl() {
  const url = process.env.SUPABASE_DB_URL?.trim();

  if (!url) {
    console.error(`SUPABASE_DB_URL is not set, so there is nothing to connect to.\n\n${SETUP}`);
    process.exit(1);
  }

  if (/(^|@)db\.[a-z0-9]+\.supabase\.co/.test(url)) {
    console.error(
      'SUPABASE_DB_URL points at the direct connection (db.<ref>.supabase.co),\n' +
        'which is IPv6-only. Use the Session pooler string instead — see Project → Connect.'
    );
    process.exit(1);
  }

  if (/:6543\b/.test(url)) {
    console.error(
      'SUPABASE_DB_URL uses port 6543, the transaction-mode pooler. Migrations need\n' +
        'session mode: the same host on port 5432.'
    );
    process.exit(1);
  }

  return url;
}

/** Runs a Supabase CLI command against the pooler, inheriting stdio. */
export function runAgainstPooler(command, extraArgs = []) {
  const url = requireDbUrl();
  console.log(`Using ${describe(url)} …`);

  const result = spawnSync(
    'npx',
    ['--yes', 'supabase', ...command, '--db-url', url, ...extraArgs],
    { stdio: 'inherit', shell: process.platform === 'win32' }
  );

  if (result.error) {
    console.error(`Could not run the Supabase CLI: ${result.error.message}`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}
