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
    include: ['lib/**/*.test.ts'],
  },
});
