import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default [
  {
    ignores: [
      'lint-staged.config.js',
      'scripts/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    ignores: ['eslint.config.js', 'scripts/**/*', '*.config.js', '*.config.cjs'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      '@stylistic': stylistic,
      import: importPlugin,
      'simple-import-sort': simpleImportSort
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx']
        }
      }
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.eslint.json']
      }
    },
    rules: {
      // ✅ TS + Style
      ...tseslint.configs.recommended.rules,
      ...stylistic.configs.recommended.rules,

      // ✅ On utilise les règles de base de stylistic
      'no-console': 'warn',

      // ✅ Vérifications d'import (doublons, résolutions, etc.)
      ...importPlugin.configs.recommended.rules,

      // ❌ On désactive le tri de `eslint-plugin-import`
      'import/order': 'off',
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          js: 'never',
          jsx: 'never',
          ts: 'never',
          tsx: 'never'
        }
      ],
      // ✅ On utilise simple-import-sort à la place
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn'
    }
  }
];
