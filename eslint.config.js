// Created by Haihs on 11/11/2026
// ESLint flat config for TypeScript packages (api, contract); Angular rules arrive in Task 7.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint'; // Haihs: lint cho apps/web - start - end

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
      // 'apps/web/**', // Haihs: đóng code cũ, apps/web nay được lint bằng angular-eslint - start - end
    ],
  },
  // Haihs: ngắt dòng ignores cho đúng printWidth 100 - end
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
  // Haihs: angular-eslint cho apps/web - start
  {
    files: ['apps/web/**/*.ts'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
    },
  },
  {
    files: ['apps/web/**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  },
  // Haihs: angular-eslint cho apps/web - end
);
