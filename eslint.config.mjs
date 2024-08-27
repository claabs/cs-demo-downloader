/* eslint-disable import-x/no-unresolved */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import globals from 'globals';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import pluginPromise from 'eslint-plugin-promise';
import tseslint from 'typescript-eslint';
import airbnbTs from 'eslint-config-airbnb-typescript-x/base';
import tsParser from '@typescript-eslint/parser';

export default [
  ...airbnbTs,
  ...tseslint.configs.recommended,
  pluginPromise.configs['flat/recommended'],
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
      ecmaVersion: 2023,
    },
  },
  { ignores: ['dist/', 'node_modules/'] },
  eslintPluginPrettierRecommended,
];
