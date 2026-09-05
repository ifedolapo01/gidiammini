import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // Mirrors the "@/*" path alias in tsconfig.json.
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    // The commerce layer is pure by design — no DOM, no Supabase, no React.
    environment: 'node',
    //
    // `app/**` is included for the same kind of module, in the places where a
    // pure helper genuinely belongs to a layer above Commerce: the Admin
    // worklist's grouping rules, for instance, are Admin vocabulary and cannot
    // move into lib/ without breaking the layering — but they are ordinary
    // functions over ordinary data and were going untested purely because of
    // where they sit. Only `.test.ts` matches, so nothing with JSX in it is
    // picked up by a node-environment run.
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
  },
});
