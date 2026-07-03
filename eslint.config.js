import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  {
    // Chrome's on-device AI globals — too new for the `globals` package.
    // Only meaningful in the offscreen document (docs/ENGINES.md Engine 2).
    files: ['src/offscreen/**/*.js'],
    languageOptions: {
      globals: {
        Translator: 'readonly',
        LanguageDetector: 'readonly',
      },
    },
  },
];
