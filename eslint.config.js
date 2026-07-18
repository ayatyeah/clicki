import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * One flat config for both workspaces. The repo had zero lint/test/CI gates, so
 * this deliberately starts strict on correctness (unused vars, undefined
 * globals, hook rules) and silent on style — style churn would bury real signal
 * in a codebase this size.
 */
export default [
  {
    ignores: [
      '**/node_modules/**',
      'client/dist/**',
      'client/public/**',
      'client/scripts/**', // one-off image tooling, CommonJS
      // The two ui/*.tsx files are the only TypeScript in the repo and there is
      // no tsconfig or TS parser — Vite compiles them with esbuild. Linting them
      // would mean pulling in typescript-eslint for two files.
      'client/src/components/ui/**',
      '.playwright-mcp/**',
    ],
  },

  // ---- Server: Node, ESM ----
  {
    files: ['server/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      // `const { password_hash, ...safe } = creator` is how this codebase strips
      // secrets before serialising; the omitted bindings are the point.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
      'no-throw-literal': 'error',
    },
  },

  // ---- Client: browser, ESM, JSX ----
  {
    files: ['client/src/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      // __BUILD_TIME__ / __BUILD_COMMIT__ are replaced at build by Vite `define`.
      globals: { ...globals.browser, __BUILD_TIME__: 'readonly', __BUILD_COMMIT__: 'readonly', __BUILD_ID__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Without these two, no-unused-vars cannot see an identifier that is only
      // referenced from JSX (`<motion.div>`, `<Seo />`) and reports it as dead.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      'no-undef': 'error',
      eqeqeq: ['error', 'smart'],
    },
  },
];
