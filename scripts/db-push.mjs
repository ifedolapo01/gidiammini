/**
 * Applies pending migrations through the connection pooler.
 *
 * See scripts/db-url.mjs for why the pooler and not the direct connection.
 * Extra CLI flags pass straight through: `npm run db:push -- --dry-run`.
 */
import { runAgainstPooler } from './db-url.mjs';

runAgainstPooler(['db', 'push'], process.argv.slice(2));
