import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', '.wrangler/**', 'coverage/**', 'public/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'prefer-const': 'error',
      'no-var': 'error',
      'no-debugger': 'error',
      'eqeqeq': ['error', 'smart'],
      'no-duplicate-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];
