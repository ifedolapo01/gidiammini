/**
 * Flat config, which is what ESLint 9 and `next lint`'s successor both expect.
 *
 * There was no ESLint config in this repo at all — and twenty-six
 * `eslint-disable-next-line` comments suppressing rules from a linter that
 * never ran. Those comments are not noise: each one marks a place somebody
 * knew was risky (mostly `react-hooks/exhaustive-deps`, i.e. a possible stale
 * closure). Turning the linter on is what makes them mean something again.
 *
 * The rules below are deliberately close to Next's defaults. A first linter on
 * a 22,000-line codebase that arrives with strong opinions produces a thousand
 * errors and gets switched off; one that catches the things that actually break
 * production gets kept.
 */
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      // Generated from the database schema by `npm run db:types`.
      'types/database.ts',
      'public/**',
    ],
  },

  // v16 of eslint-config-next exports a flat-config array directly, so this
  // needs no @eslint/eslintrc compatibility shim (which in fact throws on it).
  ...nextCoreWebVitals,

  {
    files: ['**/*.ts', '**/*.tsx'],
    // Declared here rather than relying on next/core-web-vitals to provide it:
    // a flat config can only use a rule from a plugin registered in the same
    // config object or an earlier one, and the versions do not always agree.
    languageOptions: { parser: tsparser },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      // A stale closure is the failure mode this codebase already has disable
      // comments for. A warning rather than an error: turning CI red until
      // every one is resolved would mean nobody could merge anything today.
      'react-hooks/exhaustive-deps': 'warn',

      // THE REACT COMPILER RULES, AND WHY THEY ARE WARNINGS
      //
      // eslint-plugin-react-hooks v6 ships the React Compiler's own analysis as
      // lint rules. They are worth having — but on this codebase they report
      // ~70 findings on day one, most of them `set-state-in-effect` where a
      // hook deliberately reads localStorage in an effect rather than during
      // render, because reading it during render is what causes a hydration
      // mismatch (see useTableDensity, useColumnVisibility, useOrdersView).
      //
      // Erroring on all of that would mean a CI gate that has never once been
      // green, which is a gate nobody trusts and everybody bypasses. They are
      // warnings so the count is visible and can be driven down deliberately.
      // Promote them to 'error' once it reaches zero.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',

      // This one stays an error: hooks called conditionally is not a style
      // question, it is a crash waiting for the right navigation. It found a
      // real instance in components/Header.tsx the first time it ran.
      'react-hooks/rules-of-hooks': 'error',

      // Unused imports and variables are the single most common thing to leave
      // behind in a refactor, and the one CLAUDE.md explicitly asks for.
      // `_`-prefixed names are the escape hatch for a deliberately ignored
      // argument.
      'import/no-anonymous-default-export': 'off',

      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },

  {
    // Server code logs to the platform's collector, and a stray console.log in
    // a route handler is how order numbers and customer data end up in it. The
    // logger in lib/logger.ts is the way to say something on purpose.
    files: ['app/api/**/*.ts'],
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  {
    // Test files describe failure on purpose.
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: { 'no-console': 'off' },
  },
];
