// Created by Haihs on 11/11/2026
// ESLint flat config for TypeScript packages (api, contract); Angular rules arrive in Task 7.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Haihs: ngắt dòng ignores cho đúng printWidth 100 - start
  // đóng code cũ
  // { ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/.angular/**', '**/coverage/**', 'apps/web/**'] },
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/.angular/**',
      '**/coverage/**',
      'apps/web/**',
    ],
  },
  // Haihs: ngắt dòng ignores cho đúng printWidth 100 - end
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
);
