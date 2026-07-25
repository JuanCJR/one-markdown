import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

import base from '../../eslint.config.js';

export default [
  {
    ignores: ['dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**'],
  },
  ...base,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  // `configs['recommended-latest']` sigue el formato eslintrc (plugins como array de strings);
  // el equivalente para config plana vive bajo `configs.flat`.
  reactHooks.configs.flat['recommended-latest'],
];
