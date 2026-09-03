/**
 * Lists local vs remote migrations through the connection pooler.
 *
 * Worth running before every push: supabase/migrations/README.md documents a
 * real incident where a push replayed history against a database long past it,
 * and the ledger is the only thing that says what the remote has actually
 * applied. A successful `db:types` says nothing about it — that reads the
 * schema over HTTPS, so a database can hold tables the ledger does not list.
 */
import { runAgainstPooler } from './db-url.mjs';

runAgainstPooler(['migration', 'list'], process.argv.slice(2));
