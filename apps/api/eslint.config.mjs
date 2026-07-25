import base from '../../eslint.config.js';

export default [
  {
    ignores: ['dist/**', 'coverage/**', 'src/generated/**'],
  },
  ...base,
];
