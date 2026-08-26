/**
 * Regenerates types/database.ts from the linked Supabase project.
 *
 * Wraps the CLI instead of using a shell redirect. `cmd > file` truncates the
 * file *before* the command runs, so a failure — not linked, not logged in,
 * CLI missing — silently destroys the existing types. This writes only on
 * success, and only if the output actually looks like the generated module.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const OUT = 'types/database.ts';
const args = ['--yes', 'supabase', 'gen', 'types', 'typescript', '--linked', '--schema', 'public'];

const result = spawnSync('npx', args, { encoding: 'utf8', shell: process.platform === 'win32' });

if (result.error) {
  console.error(`Could not run the Supabase CLI: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  console.error((result.stderr || '').trim() || `supabase gen types exited with code ${result.status}`);
  console.error(`\n${OUT} was left untouched.`);
  console.error('If the project is not linked yet:\n  npx --yes supabase login\n  npx --yes supabase link --project-ref <ref>');
  process.exit(result.status ?? 1);
}

const out = result.stdout ?? '';

if (!out.includes('export type Database') && !out.includes('export interface Database')) {
  console.error('The CLI returned output that does not look like generated types, so');
  console.error(`${OUT} was left untouched. First 300 characters received:\n`);
  console.error(out.slice(0, 300));
  process.exit(1);
}

writeFileSync(OUT, out, 'utf8');
console.log(`Wrote ${OUT} (${out.split('\n').length} lines) from the linked project.`);
